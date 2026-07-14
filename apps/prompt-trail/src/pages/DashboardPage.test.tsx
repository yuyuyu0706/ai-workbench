import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Project } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { DashboardPage } from './DashboardPage';

const databaseTestScope = createDatabaseTestScope('dashboard-page');

afterEach(async () => {
  await databaseTestScope.cleanup();
});

describe('DashboardPage', () => {
  it('shows a page-local loading state while the repository read is pending', () => {
    const listActiveProjects = vi.fn<() => Promise<readonly Project[]>>(
      () => new Promise(() => undefined),
    );
    const repository = {
      listActiveProjects,
    } as unknown as PromptTrailRepository;

    renderDashboardPage(repository);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Dashboardデータを読み込んでいます...',
    );
    expect(listActiveProjects).toHaveBeenCalledOnce();
  });

  it('shows the repository-backed empty state after reading a fresh database', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);

    renderDashboardPage(runtime.repository);

    expect(
      await screen.findByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Fresh DBでは自動Seedせず、Repository読み取り後の正常なEmpty Stateとして表示しています。',
      ),
    ).toBeInTheDocument();
  });

  it('shows a dashboard failure state without exposing the internal error value', async () => {
    const repository = {
      listActiveProjects: vi.fn(async () => {
        throw new Error('raw database stack detail');
      }),
    } as unknown as PromptTrailRepository;

    renderDashboardPage(repository);

    expect(
      await screen.findByText('Dashboardデータの読み込みに失敗しました。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Repositoryの読み取りに失敗しました。時間をおいてページを再読み込みしてください。',
    );
    expect(screen.queryByText('raw database stack detail')).toBeNull();
  });

  it('renders the dashboard sections without an empty message after repository data is loaded', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    await seedSampleData(runtime.repository);

    renderDashboardPage(runtime.repository);

    await waitFor(() => {
      expect(
        screen.queryByText('Dashboardデータを読み込んでいます...'),
      ).toBeNull();
    });
    expect(screen.queryByText('Empty')).toBeNull();
    expect(
      screen.queryByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: '最近のRun' }),
    ).toBeInTheDocument();
  });

  it('does not overwrite the active repository result with a stale repository result', async () => {
    let resolveRepositoryAProjects: (
      projects: readonly Project[],
    ) => void = () => undefined;
    const repositoryA = {
      listActiveProjects: vi.fn<() => Promise<readonly Project[]>>(
        () =>
          new Promise((resolve) => {
            resolveRepositoryAProjects = resolve;
          }),
      ),
    } as unknown as PromptTrailRepository;
    const repositoryB = createResolvedDataRepository();

    const { rerender } = render(
      <PromptTrailRepositoryProvider repository={repositoryA}>
        <DashboardPage />
      </PromptTrailRepositoryProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Dashboardデータを読み込んでいます...',
    );

    rerender(
      <PromptTrailRepositoryProvider repository={repositoryB}>
        <DashboardPage />
      </PromptTrailRepositoryProvider>,
    );

    await waitFor(() => {
      expect(
        screen.queryByText('Dashboardデータを読み込んでいます...'),
      ).toBeNull();
    });
    expect(screen.queryByText('Empty')).toBeNull();

    await act(async () => {
      resolveRepositoryAProjects([]);
    });

    expect(repositoryA.listActiveProjects).toHaveBeenCalledOnce();
    expect(
      screen.queryByText('Dashboardデータを読み込んでいます...'),
    ).toBeNull();
    expect(screen.queryByText('Empty')).toBeNull();
    expect(
      screen.queryByText('Repositoryに表示できるRunがまだありません。'),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: '最近のRun' }),
    ).toBeInTheDocument();
  });
});

function renderDashboardPage(repository: PromptTrailRepository) {
  return render(
    <PromptTrailRepositoryProvider repository={repository}>
      <DashboardPage />
    </PromptTrailRepositoryProvider>,
  );
}

function createResolvedDataRepository(): PromptTrailRepository {
  return {
    listActiveProjects: vi.fn(async () => [sampleDataset.project]),
    listActiveRuns: vi.fn(async () => [sampleDataset.run]),
    getRecipe: vi.fn(async () => sampleDataset.recipe),
    listActiveLinks: vi.fn(async () => sampleDataset.links),
  } as unknown as PromptTrailRepository;
}
