import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PROJECT_ID, type Link, type Run } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { findResumableRuns } from './find-resumable-runs';

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: DEFAULT_PROJECT_ID,
    trailId: 'trail-1',
    trailStepId: 'trail-step-1',
    recipeId: null,
    promptSnapshot: { promptId: 'prompt-1', title: 'Title', body: 'Body' },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: 'Body',
    status: 'in-progress',
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

describe('findResumableRuns', () => {
  it('returns only in-progress Runs that have an execution/external Link', async () => {
    const inProgressRun = buildRun({ id: 'run-1' as Run['id'] });
    const executedRun = buildRun({
      id: 'run-2' as Run['id'],
      status: 'executed',
    });
    const link = buildLink({ runId: inProgressRun.id });

    const listActiveRuns = vi
      .fn()
      .mockResolvedValue([inProgressRun, executedRun]);
    const listActiveLinks = vi.fn(async (runId: Run['id']) =>
      runId === inProgressRun.id ? [link] : [],
    );
    const repository = {
      listActiveRuns,
      listActiveLinks,
    } as unknown as PromptTrailRepository;

    const result = await findResumableRuns(repository);

    expect(listActiveRuns).toHaveBeenCalledWith(DEFAULT_PROJECT_ID);
    expect(result).toEqual([
      {
        run: inProgressRun,
        link,
        promptTrailRunId: 'agent-1',
        runId: null,
      },
    ]);
  });

  it('skips an in-progress Run whose only Link is not an execution/external one', async () => {
    const run = buildRun();
    const otherLink = buildLink({ role: 'reference', type: 'issue' });

    const repository = {
      listActiveRuns: vi.fn().mockResolvedValue([run]),
      listActiveLinks: vi.fn().mockResolvedValue([otherLink]),
    } as unknown as PromptTrailRepository;

    const result = await findResumableRuns(repository);

    expect(result).toEqual([]);
  });

  it('uses the Link externalId as runId when resolved, and falls back to title when null', async () => {
    const run = buildRun();
    const resolvedLink = buildLink({ externalId: '999' });

    const repository = {
      listActiveRuns: vi.fn().mockResolvedValue([run]),
      listActiveLinks: vi.fn().mockResolvedValue([resolvedLink]),
    } as unknown as PromptTrailRepository;

    const result = await findResumableRuns(repository);

    expect(result).toEqual([
      {
        run,
        link: resolvedLink,
        promptTrailRunId: 'agent-1',
        runId: '999',
      },
    ]);
  });
});
