import { afterEach, describe, expect, it } from 'vitest';

import type {
  Link,
  Project,
  ProjectId,
  Prompt,
  Recipe,
  Run,
  RunId,
  UtcDateTimeString,
} from '../domain';
import { createDefaultProject, DEFAULT_PROJECT_ID } from '../domain';
import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import { loadDashboardReadModel } from './dashboard-read-query';

const databaseScope = createDatabaseTestScope('dashboard-read-query');

afterEach(async () => {
  await databaseScope.cleanup();
});

function projectId(value: string): ProjectId {
  return value as ProjectId;
}

function runId(value: string): RunId {
  return value as RunId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function cloneSampleProject(overrides: Partial<Project> = {}): Project {
  return { ...sampleDataset.project, ...overrides };
}

function cloneSampleRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return { ...sampleDataset.recipe, ...overrides };
}

function cloneSampleRun(overrides: Partial<Run> = {}): Run {
  return { ...sampleDataset.run, ...overrides };
}

function cloneSampleLink(overrides: Partial<Link> = {}): Link {
  return { ...sampleDataset.links[0], ...overrides };
}

describe('loadDashboardReadModel', () => {
  it('loads Direct and Recipe Runs in updated order without resolving a Recipe for Direct Run', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: cloneSampleProject(),
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: cloneSampleRecipe(),
      run: cloneSampleRun(),
      links: [],
    });
    const directPrompt: Prompt = {
      id: 'dashboard-direct-prompt' as Prompt['id'],
      createdAt: utc('2026-07-13T00:00:00.000Z'),
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
      deletedAt: null,
      scope: 'project',
      projectId: DEFAULT_PROJECT_ID,
      title: 'Direct dashboard prompt',
      body: 'Direct body',
      kind: 'codex-request',
      status: 'active',
      tags: [],
    };
    const directRun: Run & { recipeId: null } = {
      id: 'dashboard-direct-run' as RunId,
      createdAt: utc('2026-07-13T00:00:00.000Z'),
      updatedAt: utc('2026-07-13T01:00:00.000Z'),
      deletedAt: null,
      archivedAt: null,
      projectId: DEFAULT_PROJECT_ID,
      recipeId: null,
      promptSnapshot: {
        promptId: directPrompt.id,
        title: directPrompt.title,
        body: directPrompt.body,
      },
      contextSnapshots: [],
      inputValues: {},
      finalPrompt: directPrompt.body,
      status: 'prepared',
      evaluation: null,
      improvementNote: null,
    };
    await repository.createDirectRunBundle({
      project: createDefaultProject(utc('2026-07-13T00:00:00.000Z')),
      prompt: directPrompt,
      run: directRun,
    });

    const model = await loadDashboardReadModel(repository, {
      recentRunLimit: 2,
    });
    expect(model.recentRuns.map(({ run }) => run.id)).toEqual([
      directRun.id,
      sampleDataset.run.id,
    ]);
    expect(model.recentRuns[0]).toMatchObject({ run: directRun, recipe: null });
  });

  it('loads the canonical sample dataset through repository read contracts', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(seedSampleData(repository)).resolves.toEqual({
      status: 'seeded',
    });

    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: 10 }),
    ).resolves.toEqual({
      recentRuns: [
        {
          run: sampleDataset.run,
          project: sampleDataset.project,
          recipe: sampleDataset.recipe,
          links: sampleDataset.links,
        },
      ],
    });
  });

  it('returns an empty read model for an empty database', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: 10 }),
    ).resolves.toEqual({ recentRuns: [] });
  });

  it('returns recent active runs with project, recipe, and active links ordered by run update time', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: cloneSampleProject(),
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: cloneSampleRecipe(),
      run: cloneSampleRun(),
      links: sampleDataset.links.map((link) => ({ ...link })),
    });

    const secondProject = cloneSampleProject({
      id: projectId('project-dashboard-second'),
      name: 'Second dashboard project',
      updatedAt: utc('2026-07-12T02:00:00.000Z'),
    });
    const secondRecipe = cloneSampleRecipe({
      id: 'recipe-dashboard-second' as Recipe['id'],
      projectId: secondProject.id,
      updatedAt: utc('2026-07-12T02:05:00.000Z'),
    });
    const secondRun = cloneSampleRun({
      id: runId('run-dashboard-second'),
      projectId: secondProject.id,
      recipeId: secondRecipe.id,
      updatedAt: utc('2026-07-12T03:00:00.000Z'),
    });
    const activeLink = cloneSampleLink({
      id: 'link-dashboard-second-active' as Link['id'],
      runId: secondRun.id,
      updatedAt: utc('2026-07-12T03:10:00.000Z'),
    });
    const deletedLink = cloneSampleLink({
      id: 'link-dashboard-second-deleted' as Link['id'],
      runId: secondRun.id,
      deletedAt: utc('2026-07-12T03:11:00.000Z'),
    });

    await repository.saveProject(secondProject);
    await database.recipes.put(secondRecipe);
    await repository.saveRun(secondRun);
    await repository.saveLink(activeLink);
    await repository.saveLink(deletedLink);

    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: 2 }),
    ).resolves.toEqual({
      recentRuns: [
        {
          run: secondRun,
          project: secondProject,
          recipe: secondRecipe,
          links: [activeLink],
        },
        {
          run: sampleDataset.run,
          project: sampleDataset.project,
          recipe: sampleDataset.recipe,
          links: sampleDataset.links,
        },
      ],
    });
  });

  it('excludes archived, deleted, and over-limit runs from the dashboard model', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: cloneSampleProject(),
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: cloneSampleRecipe(),
      run: cloneSampleRun(),
      links: sampleDataset.links.map((link) => ({ ...link })),
    });
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-dashboard-archived'),
        updatedAt: utc('2026-07-12T04:00:00.000Z'),
        archivedAt: utc('2026-07-12T04:10:00.000Z'),
      }),
    );
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-dashboard-deleted'),
        updatedAt: utc('2026-07-12T05:00:00.000Z'),
        deletedAt: utc('2026-07-12T05:10:00.000Z'),
      }),
    );

    const model = await loadDashboardReadModel(repository, {
      recentRunLimit: 1,
    });

    expect(model.recentRuns.map(({ run }) => run.id)).toEqual([
      sampleDataset.run.id,
    ]);
  });

  it('limits recent runs after sorting across all active projects', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: cloneSampleProject(),
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: cloneSampleRecipe(),
      run: cloneSampleRun({
        id: runId('run-dashboard-0'),
        updatedAt: utc('2026-07-12T00:00:00.000Z'),
      }),
      links: [],
    });

    await Promise.all(
      [1, 2, 3, 4].map((index) =>
        repository.saveRun(
          cloneSampleRun({
            id: runId(`run-dashboard-${index}`),
            updatedAt: utc(`2026-07-12T0${index}:00:00.000Z`),
          }),
        ),
      ),
    );

    const model = await loadDashboardReadModel(repository, {
      recentRunLimit: 3,
    });

    expect(model.recentRuns.map(({ run }) => run.id)).toEqual([
      runId('run-dashboard-4'),
      runId('run-dashboard-3'),
      runId('run-dashboard-2'),
    ]);
  });

  it('propagates an error when an active run references a missing recipe', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: cloneSampleProject(),
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: cloneSampleRecipe(),
      run: cloneSampleRun(),
      links: [],
    });
    await database.recipes.delete(sampleDataset.recipe.id);

    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: 1 }),
    ).rejects.toThrow(
      `Recipe not found for dashboard run: ${sampleDataset.run.recipeId}`,
    );
  });

  it('rejects negative and fractional recent run limits', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: -1 }),
    ).rejects.toThrow('recentRunLimit must be a non-negative integer');
    await expect(
      loadDashboardReadModel(repository, { recentRunLimit: 1.5 }),
    ).rejects.toThrow('recentRunLimit must be a non-negative integer');
  });
});
