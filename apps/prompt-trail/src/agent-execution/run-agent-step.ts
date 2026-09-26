import {
  dispatchAgentStep,
  fetchAgentStatus,
  type FetchAgentStatusResult,
} from './agent-client';
import type { Link, Run, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';

/** Poll timing (see Issue #346's "決定事項"): first wait 3s, then every 5s, capped at 2 minutes total. */
export const AGENT_STEP_INITIAL_WAIT_MS = 3_000;
export const AGENT_STEP_POLL_INTERVAL_MS = 5_000;
export const AGENT_STEP_MAX_TOTAL_WAIT_MS = 120_000;

const COMPLETED_STATES = new Set(['success', 'failure', 'cancelled']);

function defaultNow(): UtcDateTimeString {
  return new Date().toISOString() as UtcDateTimeString;
}

function defaultCreateId(): Link['id'] {
  return `link-${crypto.randomUUID()}` as Link['id'];
}

function defaultCreateRunKey(): string {
  return `agent-${crypto.randomUUID()}`;
}

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export type StartAgentStepDependencies = {
  readonly now?: () => UtcDateTimeString;
  readonly createId?: () => Link['id'];
  readonly createRunKey?: () => string;
};

export type StartAgentStepInput = {
  readonly run: Run;
  readonly forceFailure: boolean;
};

export type StartAgentStepResult = {
  readonly link: Link;
  readonly promptTrailRunId: string;
};

/**
 * Dispatches a dummy agent-step workflow run for `run` and records the
 * initial, "dispatch直後" Run/Link state: `Run.status` becomes
 * `in-progress`, and one `Link` (`external` / `execution`) is created with
 * `url` set to the workflow's Actions URL, `title` set to the generated
 * `promptTrailRunId`, and `externalId` left `null` until the run is found by
 * `pollAgentStep`.
 */
export async function startAgentStep(
  repository: PromptTrailRepository,
  input: StartAgentStepInput,
  dependencies: StartAgentStepDependencies = {},
): Promise<StartAgentStepResult> {
  const now = dependencies.now ?? defaultNow;
  const createId = dependencies.createId ?? defaultCreateId;
  const createRunKey = dependencies.createRunKey ?? defaultCreateRunKey;

  const promptTrailRunId = createRunKey();
  const { workflowUrl } = await dispatchAgentStep({
    step: 'dummy',
    promptTrailRunId,
    forceFailure: input.forceFailure,
  });

  const updatedAt = now();
  const updatedRun: Run = { ...input.run, status: 'in-progress', updatedAt };
  await repository.saveRun(updatedRun);

  const link: Link = {
    id: createId(),
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
    runId: updatedRun.id,
    url: workflowUrl,
    title: promptTrailRunId,
    type: 'external',
    role: 'execution',
    summary: 'pending',
    externalId: null,
  };
  await repository.saveLink(link);

  return { link, promptTrailRunId };
}

export type PollAgentStepInput = {
  readonly run: Run;
  readonly link: Link;
  readonly promptTrailRunId: string;
};

export type PollAgentStepDependencies = {
  readonly now?: () => UtcDateTimeString;
  readonly wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export type AgentStepProgressEvent =
  | ({ readonly kind: 'status' } & FetchAgentStatusResult)
  | { readonly kind: 'timeout' };

export type OnAgentStepProgress = (event: AgentStepProgressEvent) => void;

/**
 * Applies one `fetchAgentStatus` result to the Run/Link pair. While
 * `pending`, nothing is persisted. Once a GitHub run id is resolved,
 * `Link.url` / `externalId` / `summary` are updated ("run特定後"). On
 * completion (`success` / `failure` / `cancelled`), `Link.summary` is set to
 * the state, `Run.output` is set whenever `output` is present (regardless of
 * outcome — see #346's "決定事項"), and `Run.status` becomes `executed`.
 * Returns the Link as it stands after this call so repeat calls (the polling
 * loop, or a manual re-fetch) can chain off it.
 */
async function applyAgentStatus(
  repository: PromptTrailRepository,
  run: Run,
  link: Link,
  promptTrailRunId: string,
  now: () => UtcDateTimeString,
  signal: AbortSignal | undefined,
): Promise<{ readonly status: FetchAgentStatusResult; readonly link: Link }> {
  const status = await fetchAgentStatus(
    link.externalId !== null
      ? { runId: link.externalId }
      : { promptTrailRunId },
    signal,
  );

  let nextLink = link;
  if (status.runId !== null && nextLink.externalId === null) {
    const updatedAt = now();
    nextLink = {
      ...nextLink,
      url: status.htmlUrl ?? nextLink.url,
      externalId: String(status.runId),
      summary: 'in-progress',
      updatedAt,
    };
    await repository.saveLink(nextLink);
  }

  if (COMPLETED_STATES.has(status.state)) {
    const updatedAt = now();
    nextLink = { ...nextLink, summary: status.state, updatedAt };
    await repository.saveLink(nextLink);

    let updatedRun: Run = { ...run, status: 'executed', updatedAt };
    if (status.output !== undefined) {
      updatedRun = { ...updatedRun, output: status.output };
    }
    await repository.saveRun(updatedRun);
  }

  return { status, link: nextLink };
}

/**
 * Polls `/api/agent-status` for a dispatched run: first after 3s, then every
 * 5s, up to a 2 minute total cap. Reports every observed status to
 * `onProgress` and persists the Run/Link outcome via `applyAgentStatus`. If
 * the cap is reached without completion, the Run/Link are left as
 * `in-progress` and `onProgress` is notified with `{ kind: 'timeout' }` so
 * the caller can resume later (see `find-resumable-runs.ts`). Stops silently
 * when `signal` is aborted.
 */
export async function pollAgentStep(
  repository: PromptTrailRepository,
  input: PollAgentStepInput,
  onProgress: OnAgentStepProgress,
  dependencies: PollAgentStepDependencies = {},
  signal?: AbortSignal,
): Promise<void> {
  const now = dependencies.now ?? defaultNow;
  const wait = dependencies.wait ?? defaultWait;

  let link = input.link;
  let elapsedMs = 0;
  let isFirstWait = true;

  while (true) {
    if (signal?.aborted) return;

    const waitMs = isFirstWait
      ? AGENT_STEP_INITIAL_WAIT_MS
      : AGENT_STEP_POLL_INTERVAL_MS;
    isFirstWait = false;

    if (elapsedMs + waitMs > AGENT_STEP_MAX_TOTAL_WAIT_MS) {
      onProgress({ kind: 'timeout' });
      return;
    }

    await wait(waitMs, signal);
    if (signal?.aborted) return;
    elapsedMs += waitMs;

    let result: { readonly status: FetchAgentStatusResult; readonly link: Link };
    try {
      result = await applyAgentStatus(
        repository,
        input.run,
        link,
        input.promptTrailRunId,
        now,
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) return;
      throw error;
    }

    link = result.link;
    onProgress({ kind: 'status', ...result.status });

    if (COMPLETED_STATES.has(result.status.state)) return;
  }
}

/**
 * Fetches the current status once, outside the polling loop, and applies the
 * same Run/Link persistence as `pollAgentStep`. Backs the manual "再取得"
 * action in `AgentStepSection` so a missed automatic resume can be recovered
 * without waiting out the initial 3s delay.
 */
export async function refetchAgentStepStatus(
  repository: PromptTrailRepository,
  input: PollAgentStepInput,
  dependencies: PollAgentStepDependencies = {},
  signal?: AbortSignal,
): Promise<{ readonly status: FetchAgentStatusResult; readonly link: Link }> {
  const now = dependencies.now ?? defaultNow;
  return applyAgentStatus(
    repository,
    input.run,
    input.link,
    input.promptTrailRunId,
    now,
    signal,
  );
}
