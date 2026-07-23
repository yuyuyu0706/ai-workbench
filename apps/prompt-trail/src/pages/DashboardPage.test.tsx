import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { PromptTrailRepositoryProvider } from '../app/PromptTrailRepositoryContext';
import { buildRunDetailPath } from '../app/routes';
import { createPromptTrailRuntime } from '../app/prompt-trail-runtime';
import type { Link, Project, Recipe, Run } from '../domain';
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

  it('renders recent runs and related links from repository dashboard data', async () => {
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
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: sampleDataset.run.promptSnapshot.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(sampleDataset.project.name)).toBeInTheDocument();
    expect(screen.getByText(sampleDataset.run.status)).toBeInTheDocument();
    expect(screen.getByText(sampleDataset.run.evaluation!)).toBeInTheDocument();
    expect(screen.getByText(sampleDataset.run.updatedAt)).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();

    const detailLink = screen.getByRole('link', { name: 'Run Detailへ移動' });
    expect(detailLink).toHaveAttribute(
      'href',
      buildRunDetailPath(sampleDataset.run.id),
    );

    expect(screen.getByText('Roadmap再同期 Chat')).toBeInTheDocument();
    expect(screen.getByText(/Type: chat/)).toBeInTheDocument();
    expect(screen.getByText(/Role: source/)).toBeInTheDocument();
    expect(
      screen.getAllByText(`Recipe: ${sampleDataset.recipe.title}`),
    ).toHaveLength(sampleDataset.links.length);
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
    expect(screen.getByText('external')).toBeInTheDocument();
    expect(screen.getByText(/Type: external/)).toBeInTheDocument();
    expect(screen.getByText(/Role: reference/)).toBeInTheDocument();
    expect(
      screen.getByText(`Recipe: ${firstRecipe.title}`),
    ).toBeInTheDocument();
  });

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
    expect(screen.queryByText('Recipe')).toBeNull();
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
      screen.getByRole('heading', { level: 2, name: '最近のRun' }),
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
