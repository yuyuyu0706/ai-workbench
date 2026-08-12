import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { buildRunDetailPath } from '../app/routes';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Project, Run } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { RunListPage } from './RunListPage';
import { formatDateTime } from './date-time';

const databaseTestScope = createDatabaseTestScope('run-list-page');

afterEach(async () => {
  await databaseTestScope.cleanup();
});

describe('RunListPage', () => {
  it('shows a page-local loading state while the repository read is pending', () => {
    const listActiveProjects = vi.fn<() => Promise<readonly Project[]>>(
      () => new Promise(() => undefined),
    );
    const repository = {
      listActiveProjects,
    } as unknown as PromptTrailRepository;

    renderRunListPage(repository);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Trail一覧を読み込んでいます...',
    );
    expect(listActiveProjects).toHaveBeenCalledOnce();
  });

  it('shows the repository-backed empty state after reading a fresh database', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);

    renderRunListPage(runtime.repository);

    expect(
      await screen.findByText('Repositoryに表示できるTrailがまだありません。'),
    ).toBeInTheDocument();
  });

  it('renders every active Trail with its detail link', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    await seedSampleData(runtime.repository);

    renderRunListPage(runtime.repository);

    await waitFor(() => {
      expect(screen.queryByText('Trail一覧を読み込んでいます...')).toBeNull();
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Trail種別' }),
    ).toBeInTheDocument();
    expect(screen.getByText('その他')).toBeInTheDocument();
    const detailLink = screen.getByRole('link', {
      name: sampleDataset.run.trailTitle,
    });
    expect(detailLink).toHaveAttribute(
      'href',
      buildRunDetailPath(sampleDataset.run.id),
    );
    const updatedAt = screen.getByText(
      formatDateTime(sampleDataset.run.updatedAt),
    );
    expect(updatedAt).toHaveAttribute('datetime', sampleDataset.run.updatedAt);
  });

  it('shows a failure state without exposing the internal error value', async () => {
    const repository = {
      listActiveProjects: vi.fn(async () => {
        throw new Error('raw database stack detail');
      }),
    } as unknown as PromptTrailRepository;

    renderRunListPage(repository);

    expect(
      await screen.findByText('Trail一覧の読み込みに失敗しました。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('raw database stack detail')).toBeNull();
  });

  it('lists more than five Runs, unlike the Dashboard recent list', async () => {
    const runs = Array.from({ length: 6 }, (_, index) =>
      createRun({
        id: `run-${index}` as Run['id'],
        recipeId: null,
        trailTitle: `Trail ${index}`,
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
    const repository = createResolvedDataRepository(runs);

    renderRunListPage(repository);

    for (const run of runs) {
      expect(
        await screen.findByRole('link', { name: run.trailTitle }),
      ).toBeInTheDocument();
    }
  });
});

function renderRunListPage(repository: PromptTrailRepository) {
  return render(
    <MemoryRouter>
      <PromptTrailRepositoryProvider repository={repository}>
        <RunListPage />
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}

function createResolvedDataRepository(
  runs: readonly Run[],
): PromptTrailRepository {
  return {
    listActiveProjects: vi.fn(async () => [sampleDataset.project]),
    listActiveRuns: vi.fn(async () => runs),
    getRecipe: vi.fn(async () => sampleDataset.recipe),
    listActiveLinks: vi.fn(async () => sampleDataset.links),
  } as unknown as PromptTrailRepository;
}

function createRun(overrides: Partial<Run>): Run {
  return { ...sampleDataset.run, ...overrides };
}
