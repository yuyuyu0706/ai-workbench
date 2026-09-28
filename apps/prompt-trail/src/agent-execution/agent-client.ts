import { AgentExecutionError } from './errors';

/** `step` choices accepted by the `PromptTrail Agent Step` workflow. Only `dummy` exists today (see Lv3-3 for follow-up). */
export const AGENT_STEPS = ['dummy'] as const;

export type AgentStep = (typeof AGENT_STEPS)[number];

export type DispatchAgentStepInput = {
  readonly step: AgentStep;
  readonly promptTrailRunId: string;
  readonly issueNumber?: string;
  readonly forceFailure?: boolean;
};

export type DispatchAgentStepResult = {
  readonly accepted: boolean;
  readonly promptTrailRunId: string;
  readonly workflowUrl: string;
};

/** `state` values reported by `GET /api/agent-status`. */
export const AGENT_STATES = [
  'pending',
  'in-progress',
  'success',
  'failure',
  'cancelled',
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

export type FetchAgentStatusQuery =
  | { readonly promptTrailRunId: string; readonly runId?: undefined }
  | { readonly runId: string; readonly promptTrailRunId?: undefined };

export type FetchAgentStatusResult = {
  readonly state: AgentState;
  readonly runId: number | null;
  readonly htmlUrl: string | null;
  readonly output?: string;
  readonly raw: {
    readonly status: string | null;
    readonly conclusion: string | null;
  };
};

/**
 * Calls `POST /api/agent-dispatch` to start a `PromptTrail Agent Step`
 * workflow run. Mirrors the structure of `gateway/execute-client.ts`: a thin
 * `fetch` wrapper that normalizes failures into `AgentExecutionError` and
 * returns a typed result. Does not return a GitHub run id — the caller polls
 * `fetchAgentStatus` with the same `promptTrailRunId` (see Lv4-2 / #329).
 */
export async function dispatchAgentStep(
  input: DispatchAgentStepInput,
  signal?: AbortSignal,
): Promise<DispatchAgentStepResult> {
  let response: Response;
  try {
    response = await fetch('/api/agent-dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new AgentExecutionError('Failed to reach the Agent Dispatch API');
  }

  let payload: {
    accepted?: unknown;
    promptTrailRunId?: unknown;
    workflowUrl?: unknown;
    error?: unknown;
  } = {};
  try {
    payload = await response.json();
  } catch {
    // Fall through: an unparsable body is reported via the status check below.
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Agent Dispatch API returned an error (${response.status})`;
    throw new AgentExecutionError(message, response.status);
  }

  if (
    typeof payload.accepted !== 'boolean' ||
    typeof payload.promptTrailRunId !== 'string' ||
    typeof payload.workflowUrl !== 'string'
  ) {
    throw new AgentExecutionError(
      'Agent Dispatch API returned an unexpected response',
      response.status,
    );
  }

  return {
    accepted: payload.accepted,
    promptTrailRunId: payload.promptTrailRunId,
    workflowUrl: payload.workflowUrl,
  };
}

/**
 * Calls `GET /api/agent-status` to report the state of a dispatched run.
 * Same shape as `dispatchAgentStep`: a thin `fetch` wrapper normalizing
 * failures into `AgentExecutionError`.
 */
export async function fetchAgentStatus(
  query: FetchAgentStatusQuery,
  signal?: AbortSignal,
): Promise<FetchAgentStatusResult> {
  const params = new URLSearchParams(
    query.runId !== undefined
      ? { runId: query.runId }
      : { promptTrailRunId: query.promptTrailRunId },
  );

  let response: Response;
  try {
    response = await fetch(`/api/agent-status?${params.toString()}`, {
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new AgentExecutionError('Failed to reach the Agent Status API');
  }

  let payload: {
    state?: unknown;
    runId?: unknown;
    htmlUrl?: unknown;
    output?: unknown;
    raw?: unknown;
    error?: unknown;
  } = {};
  try {
    payload = await response.json();
  } catch {
    // Fall through: an unparsable body is reported via the status check below.
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Agent Status API returned an error (${response.status})`;
    throw new AgentExecutionError(message, response.status);
  }

  if (
    typeof payload.state !== 'string' ||
    !(AGENT_STATES as readonly string[]).includes(payload.state) ||
    (payload.runId !== null && typeof payload.runId !== 'number') ||
    (payload.htmlUrl !== null && typeof payload.htmlUrl !== 'string') ||
    typeof payload.raw !== 'object' ||
    payload.raw === null
  ) {
    throw new AgentExecutionError(
      'Agent Status API returned an unexpected response',
      response.status,
    );
  }

  const raw = payload.raw as { status?: unknown; conclusion?: unknown };

  return {
    state: payload.state as AgentState,
    runId: payload.runId as number | null,
    htmlUrl: payload.htmlUrl as string | null,
    ...(typeof payload.output === 'string' ? { output: payload.output } : {}),
    raw: {
      status: typeof raw.status === 'string' ? raw.status : null,
      conclusion: typeof raw.conclusion === 'string' ? raw.conclusion : null,
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
