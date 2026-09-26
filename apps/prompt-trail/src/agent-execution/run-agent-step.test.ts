import { describe, expect, it, vi } from 'vitest';

import type { Link, Run } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { dispatchAgentStep, fetchAgentStatus } from './agent-client';
import {
  pollAgentStep,
  startAgentStep,
  type AgentStepProgressEvent,
} from './run-agent-step';

vi.mock('./agent-client', async () => {
  const actual =
    await vi.importActual<typeof import('./agent-client')>('./agent-client');
  return {
    ...actual,
    dispatchAgentStep: vi.fn(),
    fetchAgentStatus: vi.fn(),
  };
});

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'project-1',
    trailId: 'trail-1',
    trailStepId: 'trail-step-1',
    recipeId: null,
    promptSnapshot: { promptId: 'prompt-1', title: 'Title', body: 'Body' },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: 'Body',
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
    output: null,
    messages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
    ...overrides,
  } as unknown as Run;
}

function buildLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    runId: 'run-1',
    url: 'https://github.com/example/example/actions',
    title: 'agent-1',
    type: 'external',
    role: 'execution',
    summary: 'pending',
    externalId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  } as unknown as Link;
}

function buildRepository(): {
  repository: PromptTrailRepository;
  saveRun: ReturnType<typeof vi.fn>;
  saveLink: ReturnType<typeof vi.fn>;
} {
  const saveRun = vi.fn(async (run: Run) => run);
  const saveLink = vi.fn(async (link: Link) => link);
  const repository = { saveRun, saveLink } as unknown as PromptTrailRepository;
  return { repository, saveRun, saveLink };
}

const now = () => '2026-01-02T00:00:00.000Z' as Run['updatedAt'];
const noopWait = async () => undefined;

describe('startAgentStep', () => {
  it('dispatches the dummy step, marks the Run in-progress, and creates the pending Link', async () => {
    vi.mocked(dispatchAgentStep).mockResolvedValue({
      accepted: true,
      promptTrailRunId: 'agent-1',
      workflowUrl: 'https://github.com/example/example/actions',
    });
    const { repository, saveRun, saveLink } = buildRepository();
    const run = buildRun();

    const result = await startAgentStep(
      repository,
      { run, forceFailure: false },
      {
        now,
        createId: () => 'link-1' as Link['id'],
        createRunKey: () => 'agent-1',
      },
    );

    expect(dispatchAgentStep).toHaveBeenCalledWith({
      step: 'dummy',
      promptTrailRunId: 'agent-1',
      forceFailure: false,
    });
    expect(saveRun).toHaveBeenCalledWith({
      ...run,
      status: 'in-progress',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(saveLink).toHaveBeenCalledWith({
      id: 'link-1',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: null,
      runId: run.id,
      url: 'https://github.com/example/example/actions',
      title: 'agent-1',
      type: 'external',
      role: 'execution',
      summary: 'pending',
      externalId: null,
    });
    expect(result.promptTrailRunId).toBe('agent-1');
  });

  it('generates a fresh promptTrailRunId via the default createRunKey when none is injected', async () => {
    vi.mocked(dispatchAgentStep).mockResolvedValue({
      accepted: true,
      promptTrailRunId: 'ignored',
      workflowUrl: 'https://github.com/example/example/actions',
    });
    const { repository } = buildRepository();

    const result = await startAgentStep(repository, {
      run: buildRun(),
      forceFailure: true,
    });

    expect(result.promptTrailRunId).toMatch(/^agent-[0-9a-f-]{36}$/);
    expect(dispatchAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTrailRunId: result.promptTrailRunId,
        forceFailure: true,
      }),
    );
  });
});

describe('pollAgentStep', () => {
  function collectEvents() {
    const events: AgentStepProgressEvent[] = [];
    return { onProgress: (event: AgentStepProgressEvent) => events.push(event), events };
  }

  it('does not update the Link while the run stays pending', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'pending',
      runId: null,
      htmlUrl: null,
      raw: { status: null, conclusion: null },
    });
    const { repository, saveRun, saveLink } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();
    const { onProgress, events } = collectEvents();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      onProgress,
      { now, wait: noopWait },
    );

    expect(saveLink).not.toHaveBeenCalled();
    expect(saveRun).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ kind: 'status', state: 'pending' });
    expect(events.at(-1)).toEqual({ kind: 'timeout' });
  });

  it('updates Link.url/externalId once the run is resolved', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'in-progress',
      runId: 999,
      htmlUrl: 'https://github.com/example/example/actions/runs/999',
      raw: { status: 'in_progress', conclusion: null },
    });
    const { repository, saveLink } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      () => undefined,
      { now, wait: noopWait },
    );

    expect(saveLink).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/example/example/actions/runs/999',
        externalId: '999',
        summary: 'in-progress',
      }),
    );
  });

  it('persists Run.output and status "executed" on success', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'success',
      runId: 999,
      htmlUrl: 'https://github.com/example/example/actions/runs/999',
      output: 'Generated output',
      raw: { status: 'completed', conclusion: 'success' },
    });
    const { repository, saveRun, saveLink } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      () => undefined,
      { now, wait: noopWait },
    );

    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'Generated output', status: 'executed' }),
    );
    expect(saveLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ summary: 'success' }),
    );
  });

  it('persists Run.output even when the run fails', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'failure',
      runId: 999,
      htmlUrl: 'https://github.com/example/example/actions/runs/999',
      output: 'Failure output',
      raw: { status: 'completed', conclusion: 'failure' },
    });
    const { repository, saveRun, saveLink } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      () => undefined,
      { now, wait: noopWait },
    );

    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'Failure output', status: 'executed' }),
    );
    expect(saveLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ summary: 'failure' }),
    );
  });

  it('records Link.summary "cancelled" and completes when cancelled', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'cancelled',
      runId: 999,
      htmlUrl: 'https://github.com/example/example/actions/runs/999',
      raw: { status: 'completed', conclusion: 'cancelled' },
    });
    const { repository, saveRun, saveLink } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      () => undefined,
      { now, wait: noopWait },
    );

    expect(saveLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ summary: 'cancelled' }),
    );
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'executed' }),
    );
  });

  it('leaves the Run/Link in-progress and notifies onProgress when the poll cap is reached', async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({
      state: 'in-progress',
      runId: null,
      htmlUrl: null,
      raw: { status: 'queued', conclusion: null },
    });
    const { repository, saveRun } = buildRepository();
    const run = buildRun({ status: 'in-progress' });
    const link = buildLink();
    const { onProgress, events } = collectEvents();

    await pollAgentStep(
      repository,
      { run, link, promptTrailRunId: 'agent-1' },
      onProgress,
      { now, wait: noopWait },
    );

    expect(events.at(-1)).toEqual({ kind: 'timeout' });
    expect(saveRun).not.toHaveBeenCalled();
  });
});
