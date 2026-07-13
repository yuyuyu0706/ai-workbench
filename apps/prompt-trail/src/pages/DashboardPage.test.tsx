import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Project } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { seedSampleData } from '../sample-data';
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

  it('transitions to the data skeleton after repository data is loaded', async () => {
    const database = databaseTestScope.createDatabase();
    const runtime = createPromptTrailRuntime(database);
    await seedSampleData(runtime.repository);

    renderDashboardPage(runtime.repository);

    expect(
      await screen.findByText('Dashboardデータを読み込みました。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '1件のRecent Runsを取得しました。詳細表示は後続Issueで扱います。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '最近のRun' }),
    ).toBeInTheDocument();
  });

  it('does not update state after unmounting before the repository read resolves', async () => {
    let resolveProjects: (projects: readonly Project[]) => void = () =>
      undefined;
    const listActiveProjects = vi.fn<() => Promise<readonly Project[]>>(
      () =>
        new Promise((resolve) => {
          resolveProjects = resolve;
        }),
    );
    const repository = {
      listActiveProjects,
    } as unknown as PromptTrailRepository;

    const { unmount } = renderDashboardPage(repository);
    unmount();

    resolveProjects([]);

    await waitFor(() => {
      expect(listActiveProjects).toHaveBeenCalledOnce();
    });
  });
});

function renderDashboardPage(repository: PromptTrailRepository) {
  return render(
    <PromptTrailRepositoryProvider repository={repository}>
      <DashboardPage />
    </PromptTrailRepositoryProvider>,
  );
}
