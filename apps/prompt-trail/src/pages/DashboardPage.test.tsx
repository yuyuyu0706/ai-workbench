import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { buildRunDetailPath } from '../app/routes';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Link, Project, Recipe, Run, RunStatus } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { DashboardPage } from './DashboardPage';
import { formatDashboardDateTime } from './dashboard-date-time';

const databaseTestScope = createDatabaseTestScope('dashboard-page');

afterEach(async () => {
  await databaseTestScope.cleanup();
});

describe('DashboardPage', () => {
  it('formats an ISO date in the browser local timezone', () => {
    const isoDateTime = '2026-07-25T19:59:00.000Z';
    const date = new Date(isoDateTime);
    const pad = (value: number) => String(value).padStart(2, '0');

    expect(formatDashboardDateTime(isoDateTime)).toBe(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    );
  });

  it('keeps an invalid date value so rendering does not fail', () => {
    expect(formatDashboardDateTime('invalid-date')).toBe('invalid-date');
  });

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

  it('renders recent Trails with only their related-link count', async () => {
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
      screen.getByRole('heading', { level: 2, name: '最近のTrail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: sampleDataset.run.promptSnapshot.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Trail名' }),
    ).toBeInTheDocument();
    expect(screen.getByText('完了')).toHaveClass('pt-status-pin--done');
    expect(screen.queryByText(sampleDataset.project.name)).toBeNull();
    expect(screen.queryByText(sampleDataset.run.evaluation!)).toBeNull();
    const updatedAt = screen.getByText(
      formatDashboardDateTime(sampleDataset.run.updatedAt),
    );
    expect(updatedAt).toHaveAttribute('datetime', sampleDataset.run.updatedAt);
    expect(screen.getByText('3件')).toBeInTheDocument();

    const detailLink = screen.getByRole('link', { name: 'Trailを確認' });
    expect(detailLink).toHaveAttribute(
      'href',
      buildRunDetailPath(sampleDataset.run.id),
    );

    expect(
      screen.getByRole('columnheader', { name: '関連リンク' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Recipe' })).toBeNull();
    expect(
      screen.queryByText(
        '最近作成したTrailを確認できます。詳細なPromptと関連リンクはTrailから確認してください。',
      ),
    ).toBeNull();
    expect(screen.queryByText('Roadmap再同期 Chat')).toBeNull();
    expect(screen.queryByText(/Type: chat/)).toBeNull();
    expect(screen.queryByText(/Role: source/)).toBeNull();
    expect(
      screen.queryByText(`Recipe: ${sampleDataset.recipe.title}`),
    ).toBeNull();
  });

  it('keeps recent runs in read model order and does not fabricate null evaluation text', async () => {
    const firstRun = createRun({
      id: 'run-newer' as Run['id'],
      recipeId: 'recipe-newer' as Run['recipeId'],
      status: 'in-progress',
      evaluation: null,
      updatedAt: '2026-07-13T00:00:00.000Z' as Run['updatedAt'],
    });
    const secondRun = createRun({
      id: 'run-older' as Run['id'],
      recipeId: 'recipe-older' as Run['recipeId'],
      status: 'done',
      evaluation: 'needs-improvement',
      updatedAt: '2026-07-12T00:00:00.000Z' as Run['updatedAt'],
    });
    const firstRecipe = createRecipe({
      id: 'recipe-newer' as Recipe['id'],
      title: '先に表示されるRecipe',
    });
    const secondRecipe = createRecipe({
      id: 'recipe-older' as Recipe['id'],
      title: '後に表示されるRecipe',
    });
    const fallbackTitleLink = createLink({
      id: 'link-fallback' as Link['id'],
      runId: firstRun.id,
      title: null,
      type: 'external',
      role: 'reference',
    });
    const repository = createResolvedDataRepository({
      runs: [firstRun, secondRun],
      recipes: new Map([
        [firstRun.recipeId, firstRecipe],
        [secondRun.recipeId, secondRecipe],
      ]),
      linksByRunId: new Map([[firstRun.id, [fallbackTitleLink]]]),
    });

    renderDashboardPage(repository);

    const runHeadings = await screen.findAllByRole('heading', { level: 3 });
    expect(runHeadings.map((heading) => heading.textContent)).toEqual([
      firstRun.promptSnapshot.title,
      secondRun.promptSnapshot.title,
    ]);
    expect(screen.queryByText('未評価')).toBeNull();
    expect(screen.queryByText('なし')).toBeNull();
    expect(screen.getByText('1件')).toBeInTheDocument();
    expect(screen.queryByText('external')).toBeNull();
    expect(screen.queryByText(/Type: external/)).toBeNull();
    expect(screen.queryByText(/Role: reference/)).toBeNull();
    expect(screen.queryByText(`Recipe: ${firstRecipe.title}`)).toBeNull();
    expect(screen.getByText('実行中')).toHaveClass(
      'pt-status-pin--in-progress',
    );
  });

  it.each<readonly [RunStatus, string]>([
    ['draft', '下書き'],
    ['prepared', '準備済み'],
    ['in-progress', '実行中'],
    ['executed', '実行済み'],
    ['done', '完了'],
  ])(
    'renders the %s status with its Japanese pin label',
    async (status, label) => {
      const run = createRun({
        id: `run-${status}` as Run['id'],
        status,
      });

      renderDashboardPage(createResolvedDataRepository({ runs: [run] }));

      expect(await screen.findByText(label)).toHaveClass(
        'pt-status-pin',
        `pt-status-pin--${status}`,
      );
    },
  );

  it('renders a Direct Run Snapshot title without Recipe metadata', async () => {
    const directRun = createRun({
      id: 'direct-dashboard-run' as Run['id'],
      recipeId: null,
      promptSnapshot: {
        promptId:
          'direct-dashboard-prompt' as Run['promptSnapshot']['promptId'],
        title: 'Direct Run Prompt',
        body: 'Direct body',
      },
      contextSnapshots: [],
      inputValues: {},
      finalPrompt: 'Direct body',
    });

    renderDashboardPage(createResolvedDataRepository({ runs: [directRun] }));

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Direct Run Prompt',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Recipe' })).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/Recipe:/)).toBeNull();
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
      <MemoryRouter>
        <PromptTrailRepositoryProvider repository={repositoryA}>
          <DashboardPage />
        </PromptTrailRepositoryProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Dashboardデータを読み込んでいます...',
    );

    rerender(
      <MemoryRouter>
        <PromptTrailRepositoryProvider repository={repositoryB}>
          <DashboardPage />
        </PromptTrailRepositoryProvider>
      </MemoryRouter>,
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
      screen.getByRole('heading', { level: 2, name: '最近のTrail' }),
    ).toBeInTheDocument();
  });
});

function renderDashboardPage(repository: PromptTrailRepository) {
  return render(
    <MemoryRouter>
      <PromptTrailRepositoryProvider repository={repository}>
        <DashboardPage />
      </PromptTrailRepositoryProvider>
    </MemoryRouter>,
  );
}

type ResolvedDataRepositoryOptions = {
  readonly runs?: readonly Run[];
  readonly recipes?: ReadonlyMap<Run['recipeId'], Recipe>;
  readonly linksByRunId?: ReadonlyMap<Run['id'], readonly Link[]>;
};

function createResolvedDataRepository(
  options: ResolvedDataRepositoryOptions = {},
): PromptTrailRepository {
  return {
    listActiveProjects: vi.fn(async () => [sampleDataset.project]),
    listActiveRuns: vi.fn(async () => options.runs ?? [sampleDataset.run]),
    getRecipe: vi.fn(
      async (recipeId: Run['recipeId']) =>
        options.recipes?.get(recipeId) ?? sampleDataset.recipe,
    ),
    listActiveLinks: vi.fn(
      async (runId: Run['id']) =>
        options.linksByRunId?.get(runId) ?? sampleDataset.links,
    ),
  } as unknown as PromptTrailRepository;
}

function createRun(overrides: Partial<Run>): Run {
  return { ...sampleDataset.run, ...overrides };
}

function createRecipe(overrides: Partial<Recipe>): Recipe {
  return { ...sampleDataset.recipe, ...overrides };
}

function createLink(overrides: Partial<Link>): Link {
  return { ...sampleDataset.links[0], ...overrides };
}
