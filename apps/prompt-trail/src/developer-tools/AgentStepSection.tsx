import { useEffect, useRef, useState } from 'react';

import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { AgentExecutionError } from '../agent-execution/errors';
import { findResumableRuns } from '../agent-execution/find-resumable-runs';
import {
  pollAgentStep,
  refetchAgentStepStatus,
  startAgentStep,
  type PollAgentStepInput,
} from '../agent-execution/run-agent-step';
import type { FetchAgentStatusResult } from '../agent-execution/agent-client';
import { DEFAULT_PROJECT_ID, type Run } from '../domain';
import type { PromptTrailRepository } from '../repository';

const FORCE_FAILURE_OPTIONS = ['false', 'true'] as const;

type RunOption = {
  readonly run: Run;
  readonly label: string;
};

type AgentStatusDisplay = FetchAgentStatusResult;

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'polling'; readonly status: AgentStatusDisplay | null }
  | { readonly kind: 'completed'; readonly status: AgentStatusDisplay }
  | { readonly kind: 'timeout'; readonly status: AgentStatusDisplay | null }
  | { readonly kind: 'error'; readonly message: string };

async function loadRunOptions(
  repository: PromptTrailRepository,
): Promise<readonly RunOption[]> {
  const runs = await repository.listActiveRuns(DEFAULT_PROJECT_ID);
  const sortedRuns = [...runs].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );

  const options: RunOption[] = [];
  for (const run of sortedRuns) {
    const [trail, trailStep] = await Promise.all([
      repository.getTrail(run.trailId),
      repository.getTrailStep(run.trailStepId),
    ]);
    const trailLabel = trail?.title ?? '(不明なTrail)';
    const stepLabel = trailStep?.title ?? '(不明なStep)';
    options.push({
      run,
      label: `${trailLabel} / ${stepLabel} / ${run.updatedAt}`,
    });
  }

  return options;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof AgentExecutionError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function AgentStepSection() {
  const repository = usePromptTrailRepository();
  const [runOptions, setRunOptions] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly options: readonly RunOption[] }
    | { readonly status: 'failed' }
  >({ status: 'loading' });
  const [selectedRunId, setSelectedRunId] = useState<Run['id'] | ''>('');
  const [forceFailure, setForceFailure] =
    useState<(typeof FORCE_FAILURE_OPTIONS)[number]>('false');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const [pollContext, setPollContext] = useState<PollAgentStepInput | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    loadRunOptions(repository)
      .then((options) => {
        if (requestId.current === currentRequest)
          setRunOptions({ status: 'ready', options });
      })
      .catch(() => {
        if (requestId.current === currentRequest)
          setRunOptions({ status: 'failed' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, mirroring ExecuteSection's data loads.
  }, []);

  function beginPolling(pollInput: PollAgentStepInput) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPollContext(pollInput);
    setPhase({ kind: 'polling', status: null });

    pollAgentStep(
      repository,
      pollInput,
      (event) => {
        if (controller.signal.aborted) return;
        if (event.kind === 'timeout') {
          setPhase({ kind: 'timeout', status: null });
          return;
        }
        const status: AgentStatusDisplay = event;
        setPollContext((current) =>
          current !== null &&
          status.runId !== null &&
          current.link.externalId === null
            ? {
                ...current,
                link: { ...current.link, externalId: String(status.runId) },
              }
            : current,
        );
        setPhase(
          status.state === 'success' ||
            status.state === 'failure' ||
            status.state === 'cancelled'
            ? { kind: 'completed', status }
            : { kind: 'polling', status },
        );
      },
      {},
      controller.signal,
    ).catch((error) => {
      if (controller.signal.aborted) return;
      setPhase({
        kind: 'error',
        message: describeError(
          error,
          'エージェント実行状態の取得に失敗しました。',
        ),
      });
    });
  }

  async function resumeIfPossible() {
    if (phase.kind !== 'idle') return;
    try {
      const resumable = await findResumableRuns(repository);
      if (resumable.length === 0) return;
      const [target] = resumable;
      setSelectedRunId(target.run.id);
      beginPolling({
        run: target.run,
        link: target.link,
        promptTrailRunId: target.promptTrailRunId,
      });
    } catch {
      // No resumable run found or the lookup failed silently: the viewer can
      // still start a new run or use 再取得 once one exists.
    }
  }

  function handleToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) {
      void resumeIfPossible();
    } else {
      abortControllerRef.current?.abort();
    }
  }

  const selectedRun =
    runOptions.status === 'ready'
      ? (runOptions.options.find((option) => option.run.id === selectedRunId)
          ?.run ?? null)
      : null;

  const isExecuting =
    phase.kind === 'starting' || phase.kind === 'polling';

  async function handleExecute() {
    if (selectedRun === null) return;
    setPhase({ kind: 'starting' });
    try {
      const { link, promptTrailRunId } = await startAgentStep(repository, {
        run: selectedRun,
        forceFailure: forceFailure === 'true',
      });
      beginPolling({ run: selectedRun, link, promptTrailRunId });
    } catch (error) {
      setPhase({
        kind: 'error',
        message: describeError(error, 'エージェント実行の起動に失敗しました。'),
      });
    }
  }

  async function handleRefetch() {
    const pollInput = pollContext;
    if (pollInput === null) return;
    try {
      const { status, link } = await refetchAgentStepStatus(
        repository,
        pollInput,
      );
      setPollContext({ ...pollInput, link });
      setPhase(
        status.state === 'success' ||
          status.state === 'failure' ||
          status.state === 'cancelled'
          ? { kind: 'completed', status }
          : { kind: 'polling', status },
      );
    } catch (error) {
      setPhase({
        kind: 'error',
        message: describeError(
          error,
          'エージェント実行状態の再取得に失敗しました。',
        ),
      });
    }
  }

  const displayedStatus: AgentStatusDisplay | null =
    phase.kind === 'polling' || phase.kind === 'timeout'
      ? phase.status
      : phase.kind === 'completed'
        ? phase.status
        : null;

  return (
    <details className="developer-tools__section" onToggle={handleToggle}>
      <summary>
        <h3>エージェント実行（ダミー）</h3>
      </summary>
      <p>
        ダミーのエージェント実行ワークフローを起動し、選択したRunに実行結果（成功・失敗・cancel）を保存できることを確認します。
      </p>

      <label className="developer-tools__field">
        <span>対象Run</span>
        <select
          value={selectedRunId}
          disabled={isExecuting || runOptions.status !== 'ready'}
          onChange={(event) =>
            setSelectedRunId(event.target.value as Run['id'])
          }
        >
          <option value="">選択してください</option>
          {runOptions.status === 'ready'
            ? runOptions.options.map((option) => (
                <option key={option.run.id} value={option.run.id}>
                  {option.label}
                </option>
              ))
            : null}
        </select>
      </label>
      {runOptions.status === 'failed' ? (
        <p role="alert">Runの一覧を読み込めませんでした。</p>
      ) : null}

      {selectedRun !== null && selectedRun.output !== null ? (
        <p>
          このRunには既に実行結果が入っています。実行すると上書きされます。
        </p>
      ) : null}

      <label className="developer-tools__field">
        <span>forceFailure</span>
        <select
          value={forceFailure}
          disabled={isExecuting}
          onChange={(event) =>
            setForceFailure(
              event.target.value as (typeof FORCE_FAILURE_OPTIONS)[number],
            )
          }
        >
          {FORCE_FAILURE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <div className="developer-tools__actions">
        <button
          className="pt-button pt-button--primary"
          type="button"
          disabled={isExecuting || selectedRun === null}
          onClick={() => void handleExecute()}
        >
          {phase.kind === 'starting' ? '起動中...' : '実行'}
        </button>
        <button
          className="pt-button pt-button--secondary"
          type="button"
          disabled={isExecuting || pollContext === null}
          onClick={() => void handleRefetch()}
        >
          再取得
        </button>
      </div>

      <p role="status">
        {phase.kind === 'starting'
          ? 'ワークフローを起動しています...'
          : phase.kind === 'timeout'
            ? `state: pending（ポーリングの上限に達しました。再取得で状態を取り直せます）`
            : displayedStatus
              ? `state: ${displayedStatus.state} / run id: ${
                  displayedStatus.runId ?? '(未確定)'
                } / status: ${displayedStatus.raw.status ?? '(なし)'} / conclusion: ${
                  displayedStatus.raw.conclusion ?? '(なし)'
                }`
              : phase.kind === 'idle'
                ? '未実行です。'
                : ''}
        {displayedStatus?.htmlUrl ? (
          <>
            {' '}
            <a href={displayedStatus.htmlUrl} target="_blank" rel="noreferrer">
              Actionsで確認する
            </a>
          </>
        ) : null}
      </p>

      {phase.kind === 'completed' && phase.status.output !== undefined ? (
        <p className="developer-tools__execute-result">
          {phase.status.output}
        </p>
      ) : null}

      {phase.kind === 'error' ? <p role="alert">{phase.message}</p> : null}
    </details>
  );
}
