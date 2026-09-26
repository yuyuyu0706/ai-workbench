import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import type { Run, Trail, TrailStep } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { AgentStepSection } from './AgentStepSection';

vi.mock('../agent-execution/find-resumable-runs', () => ({
  findResumableRuns: vi.fn().mockResolvedValue([]),
}));
vi.mock('../agent-execution/run-agent-step', () => ({
  startAgentStep: vi.fn(),
  pollAgentStep: vi.fn(),
  refetchAgentStepStatus: vi.fn(),
}));

import { findResumableRuns } from '../agent-execution/find-resumable-runs';
import {
  pollAgentStep,
  startAgentStep,
} from '../agent-execution/run-agent-step';

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'project-1',
    trailId: 'trail-1',
    trailStepId: 'trail-step-1',
    recipeId: null,
    promptSnapshot: { promptId: 'prompt-1', title: 'Prompt', body: 'Body' },
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

function buildTrail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 'trail-1',
    projectId: 'project-1',
    title: 'サンプルTrail',
    kind: 'development',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
    ...overrides,
  } as unknown as Trail;
}

function buildTrailStep(overrides: Partial<TrailStep> = {}): TrailStep {
  return {
    id: 'trail-step-1',
    trailId: 'trail-1',
    order: 1,
    kind: 'prompt',
    title: 'サンプルStep',
    promptId: 'prompt-1',
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  } as unknown as TrailStep;
}

function buildRepository(
  overrides: Partial<PromptTrailRepository> = {},
): PromptTrailRepository {
  return {
    listActiveRuns: vi.fn().mockResolvedValue([buildRun()]),
    getTrail: vi.fn().mockResolvedValue(buildTrail()),
    getTrailStep: vi.fn().mockResolvedValue(buildTrailStep()),
    ...overrides,
  } as unknown as PromptTrailRepository;
}

function renderSection(repository: PromptTrailRepository) {
  return render(
    <PromptTrailRepositoryProvider repository={repository}>
      <AgentStepSection />
    </PromptTrailRepositoryProvider>,
  );
}

async function openSection() {
  const heading = await screen.findByRole('heading', {
    name: 'エージェント実行（ダミー）',
  });
  await userEvent.click(heading.closest('summary')!);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('AgentStepSection', () => {
  it('lists Runs labelled with their Trail name and Step name', async () => {
    const repository = buildRepository();
    renderSection(repository);
    await openSection();

    expect(
      await screen.findByRole('option', {
        name: /サンプルTrail \/ サンプルStep/,
      }),
    ).toBeInTheDocument();
  });

  it('shows an overwrite warning only when the selected Run already has output', async () => {
    const runWithOutput = buildRun({ output: '既存の出力' });
    const repository = buildRepository({
      listActiveRuns: vi.fn().mockResolvedValue([runWithOutput]),
    });
    renderSection(repository);
    await openSection();

    await userEvent.selectOptions(
      await screen.findByLabelText('対象Run'),
      runWithOutput.id,
    );

    expect(
      screen.getByText(/このRunには既に実行結果が入っています/),
    ).toBeInTheDocument();
  });

  it('does not show the overwrite warning for a Run without output', async () => {
    const repository = buildRepository();
    renderSection(repository);
    await openSection();

    await userEvent.selectOptions(
      await screen.findByLabelText('対象Run'),
      'run-1',
    );

    expect(
      screen.queryByText(/このRunには既に実行結果が入っています/),
    ).not.toBeInTheDocument();
  });

  it('disables the select and buttons while executing', async () => {
    const repository = buildRepository();
    vi.mocked(startAgentStep).mockImplementation(
      () => new Promise(() => undefined),
    );
    renderSection(repository);
    await openSection();

    await userEvent.selectOptions(
      await screen.findByLabelText('対象Run'),
      'run-1',
    );
    await userEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(screen.getByLabelText('対象Run')).toBeDisabled();
    expect(screen.getByLabelText('forceFailure')).toBeDisabled();
    expect(screen.getByRole('button', { name: '再取得' })).toBeDisabled();
  });

  it('shows the state transition from pending to success', async () => {
    const repository = buildRepository();
    vi.mocked(startAgentStep).mockResolvedValue({
      link: {
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
      } as never,
      promptTrailRunId: 'agent-1',
    });
    vi.mocked(pollAgentStep).mockImplementation(
      async (_repository, _input, onProgress) => {
        onProgress({
          kind: 'status',
          state: 'pending',
          runId: null,
          htmlUrl: null,
          raw: { status: null, conclusion: null },
        });
        onProgress({
          kind: 'status',
          state: 'success',
          runId: 999,
          htmlUrl: 'https://github.com/example/example/actions/runs/999',
          output: 'Generated output',
          raw: { status: 'completed', conclusion: 'success' },
        });
      },
    );
    renderSection(repository);
    await openSection();

    await userEvent.selectOptions(
      await screen.findByLabelText('対象Run'),
      'run-1',
    );
    await userEvent.click(screen.getByRole('button', { name: '実行' }));

    expect(await screen.findByText(/state: success/)).toBeInTheDocument();
    expect(screen.getByText('Generated output')).toBeInTheDocument();
  });

  it('resumes polling for an in-progress Run when the section is opened', async () => {
    const resumableRun = buildRun({ status: 'in-progress' });
    const resumableLink = {
      id: 'link-1',
      runId: resumableRun.id,
      url: 'https://github.com/example/example/actions',
      title: 'agent-1',
      type: 'external',
      role: 'execution',
      summary: 'pending',
      externalId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    vi.mocked(findResumableRuns).mockResolvedValue([
      {
        run: resumableRun,
        link: resumableLink as never,
        promptTrailRunId: 'agent-1',
        runId: null,
      },
    ]);
    vi.mocked(pollAgentStep).mockResolvedValue(undefined);
    const repository = buildRepository({
      listActiveRuns: vi.fn().mockResolvedValue([resumableRun]),
    });

    renderSection(repository);
    await openSection();

    await waitFor(() => expect(pollAgentStep).toHaveBeenCalled());
    expect(vi.mocked(pollAgentStep).mock.calls[0][1]).toMatchObject({
      run: resumableRun,
      promptTrailRunId: 'agent-1',
    });
  });
});
