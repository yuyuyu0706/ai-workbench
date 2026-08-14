import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { buildTrailDetailPath } from '../app/routes';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Project, Run, Trail } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { TrailListPage } from './TrailListPage';
import { formatDateTime } from './date-time';

const databaseTestScope = createDatabaseTestScope('trail-list-page');

afterEach(async () => {
  await databaseTestScope.cleanup();
});

describe('TrailListPage', () => {
  it('shows a page-local loading state while the repository read is pending', () => {
    const listActiveProjects = vi.fn<() => Promise<readonly Project[]>>(
      () => new Promise(() => undefined),
    );
    const repository = {
      listActiveProjects,
    } as unknown as PromptTrailRepository;

    renderTrailListPage(repository);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Trail一覧を読み込んでいます...',
    );
    expect(listActiveProjects).toHaveBeenCalledOnce();
  });

  it('shows the repository-backed empty state after reading a fresh database', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);

    renderTrailListPage(runtime.repository);

    expect(
      await screen.findByText('Repositoryに表示できるTrailがまだありません。'),
    ).toBeInTheDocument();
  });

  it('renders every active Trail with its detail link', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    await seedSampleData(runtime.repository);

    renderTrailListPage(runtime.repository);

    await waitFor(() => {
      expect(screen.queryByText('Trail一覧を読み込んでいます...')).toBeNull();
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Trail種別' }),
    ).toBeInTheDocument();
    expect(screen.getByText('その他')).toBeInTheDocument();
    const detailLink = screen.getByRole('link', {
      name: sampleDataset.trail.title,
    });
    expect(detailLink).toHaveAttribute(
      'href',
      buildTrailDetailPath(sampleDataset.trail.id),
    );
    const updatedAt = screen.getByText(
      formatDateTime(sampleDataset.trail.updatedAt),
    );
    expect(updatedAt).toHaveAttribute(
      'datetime',
      sampleDataset.trail.updatedAt,
    );
  });

  it('shows a failure state without exposing the internal error value', async () => {
    const repository = {
      listActiveProjects: vi.fn(async () => {
        throw new Error('raw database stack detail');
      }),
    } as unknown as PromptTrailRepository;

    renderTrailListPage(repository);

    expect(
      await screen.findByText('Trail一覧の読み込みに失敗しました。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('raw database stack detail')).toBeNull();
  });

  it('lists more than five Trails, unlike the Dashboard recent list', async () => {
    const trails = Array.from({ length: 6 }, (_, index) =>
      createTrail({
        id: `trail-${index}` as Trail['id'],
        title: `Trail ${index}`,
      }),
    );
    const runs = trails.map((trail, index) =>
      createRun({
        id: `run-${index}` as Run['id'],
        recipeId: null,
        trailId: trail.id,
        promptSnapshot: {
          promptId: `prompt-${index}` as Run['promptSnapshot']['promptId'],
          title: `Trail ${index}`,
          body: 'body',
        },
        contextSnapshots: [],
        inputValues: {},
        finalPrompt: 'body',
        updatedAt: `2026-07-${10 + index}T00:00:00.000Z` as Run['updatedAt'],
      }),
    );
    const repository = createResolvedDataRepository(runs, trails);

    renderTrailListPage(repository);

    for (const trail of trails) {
      expect(
        await screen.findByRole('link', { name: trail.title }),
      ).toBeInTheDocument();
    }
  });
});

function renderTrailListPage(repository: PromptTrailRepository) {
  return render(
    <MemoryRouter>
      <PromptTrailRepositoryProvider repository={repository}>
        <TrailListPage />
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}

function createResolvedDataRepository(
  runs: readonly Run[],
  trails: readonly Trail[] = [sampleDataset.trail],
): PromptTrailRepository {
  return {
    listActiveProjects: vi.fn(async () => [sampleDataset.project]),
    listActiveTrails: vi.fn(async () => trails),
    listRunsByTrail: vi.fn(async (trailId: Trail['id']) =>
      runs.filter((run) => run.trailId === trailId),
    ),
    listActiveLinks: vi.fn(async () => sampleDataset.links),
  } as unknown as PromptTrailRepository;
}

function createRun(overrides: Partial<Run>): Run {
  return { ...sampleDataset.run, ...overrides };
}

function createTrail(overrides: Partial<Trail>): Trail {
  return { ...sampleDataset.trail, ...overrides };
}
