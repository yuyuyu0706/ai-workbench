import { afterEach, describe, expect, it } from 'vitest';

import type {
  ContextId,
  Link,
  LinkId,
  Project,
  ProjectId,
  PromptId,
  Recipe,
  RecipeId,
  Run,
  RunId,
  UtcDateTimeString,
} from '../domain';
import type { PromptTrailDatabase } from '../db';
import { createDatabaseTestScope } from '../test/database-test-utils';

import {
  PromptTrailRepository,
  type PromptTrailRepositoryErrorCode,
} from './index';

const databaseScope = createDatabaseTestScope('run-link-repository');

afterEach(async () => {
  await databaseScope.cleanup();
});

function projectId(value: string): ProjectId {
  return value as ProjectId;
}

function promptId(value: string): PromptId {
  return value as PromptId;
}

function contextId(value: string): ContextId {
  return value as ContextId;
}

function recipeId(value: string): RecipeId {
  return value as RecipeId;
}

function runId(value: string): RunId {
  return value as RunId;
}

function linkId(value: string): LinkId {
  return value as LinkId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function expectedRepositoryError(code: PromptTrailRepositoryErrorCode) {
  return {
    name: 'PromptTrailRepositoryError',
    code,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: projectId('project-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    archivedAt: null,
    name: 'Project 1',
    description: 'A test project',
    tags: ['test'],
    repositoryUrl: null,
    ...overrides,
  };
}

function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: recipeId('recipe-1'),
    createdAt: utc('2026-07-06T00:00:00.000Z'),
    updatedAt: utc('2026-07-06T00:00:00.000Z'),
    deletedAt: null,
    projectId: projectId('project-1'),
    title: 'Recipe 1',
    description: 'Recipe description',
    promptId: promptId('prompt-1'),
    contextIds: [contextId('context-1'), contextId('context-2')],
    ...overrides,
  };
}

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: runId('run-1'),
    createdAt: utc('2026-07-06T01:00:00.000Z'),
    updatedAt: utc('2026-07-06T01:00:00.000Z'),
    deletedAt: null,
    archivedAt: null,
    projectId: projectId('project-1'),
    recipeId: recipeId('recipe-1'),
    promptSnapshot: {
      promptId: promptId('prompt-1'),
      title: 'Snapshot prompt',
      body: 'Snapshot prompt body',
    },
    contextSnapshots: [
      {
        contextId: contextId('context-1'),
        title: 'Context snapshot 1',
        body: 'Context snapshot body 1',
      },
      {
        contextId: contextId('context-2'),
        title: 'Context snapshot 2',
        body: 'Context snapshot body 2',
      },
    ],
    inputValues: { feature: 'Run/Link', retry: 1 },
    finalPrompt: 'Final composed prompt',
    status: 'done',
    evaluation: 'good',
    improvementNote: 'Keep it',
    ...overrides,
  };
}

function buildLink(overrides: Partial<Link> = {}): Link {
  return {
    id: linkId('link-1'),
    createdAt: utc('2026-07-06T02:00:00.000Z'),
    updatedAt: utc('2026-07-06T02:00:00.000Z'),
    deletedAt: null,
    runId: runId('run-1'),
    url: 'https://example.com/result',
    title: 'Result',
    type: 'document',
    role: 'result',
    summary: 'External result',
    externalId: 'ext-1',
    ...overrides,
  };
}

async function seedProjectRecipe(
  repository: PromptTrailRepository,
  database: PromptTrailDatabase,
) {
  const project = buildProject();
  const recipe = buildRecipe();

  await repository.saveProject(project);
  await database.recipes.put(recipe);

  return { project, recipe };
}

describe('PromptTrailRepository run persistence', () => {
  it('saves, gets, lists, and soft deletes runs while preserving supplied trail fields', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedProjectRecipe(repository, database);
    const run = buildRun();

    await expect(repository.saveRun(run)).resolves.toEqual(run);
    await expect(repository.getRun(run.id)).resolves.toEqual(run);
    await expect(repository.listActiveRuns(run.projectId)).resolves.toEqual([
      run,
    ]);

    const deletedAt = utc('2026-07-06T03:00:00.000Z');
    await expect(repository.softDeleteRun(run.id, deletedAt)).resolves.toEqual({
      ...run,
      deletedAt,
    });
    await expect(repository.getRun(run.id)).resolves.toEqual({
      ...run,
      deletedAt,
    });
    await expect(repository.listActiveRuns(run.projectId)).resolves.toEqual([]);
  });

  it('allows archived projects and rejects unavailable or mismatched run references without changing existing runs', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const { project, recipe } = await seedProjectRecipe(repository, database);
    const existingRun = buildRun();

    await repository.saveRun(existingRun);
    await repository.saveProject({
      ...project,
      archivedAt: utc('2026-07-06T04:00:00.000Z'),
    });
    await expect(
      repository.saveRun(buildRun({ id: runId('run-archived-project') })),
    ).resolves.toMatchObject({ id: runId('run-archived-project') });

    await expect(
      repository.saveRun(
        buildRun({
          id: runId('run-missing-project'),
          projectId: projectId('missing-project'),
        }),
      ),
    ).rejects.toMatchObject(expectedRepositoryError('reference-not-found'));
    await repository.saveProject({
      ...project,
      deletedAt: utc('2026-07-06T05:00:00.000Z'),
    });
    await expect(
      repository.saveRun(buildRun({ id: runId('run-deleted-project') })),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));
    await repository.saveProject(project);
    await database.recipes.put({
      ...recipe,
      deletedAt: utc('2026-07-06T06:00:00.000Z'),
    });
    await expect(
      repository.saveRun(buildRun({ id: runId('run-deleted-recipe') })),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));
    await database.recipes.put(recipe);
    await expect(
      repository.saveRun(buildRun({ projectId: projectId('other-project') })),
    ).rejects.toMatchObject(expectedRepositoryError('reference-not-found'));
    await repository.saveProject(
      buildProject({ id: projectId('other-project') }),
    );
    await expect(
      repository.saveRun(buildRun({ projectId: projectId('other-project') })),
    ).rejects.toMatchObject(expectedRepositoryError('project-mismatch'));

    await expect(repository.getRun(existingRun.id)).resolves.toEqual(
      existingRun,
    );
  });

  it('rejects prompt and context snapshot mismatches transactionally', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedProjectRecipe(repository, database);
    const existingRun = buildRun();
    await repository.saveRun(existingRun);

    const cases: readonly Run[] = [
      buildRun({
        id: runId('bad-prompt'),
        promptSnapshot: {
          promptId: promptId('other-prompt'),
          title: 't',
          body: 'b',
        },
      }),
      buildRun({
        id: runId('bad-count'),
        contextSnapshots: [buildRun().contextSnapshots[0]],
      }),
      buildRun({
        id: runId('bad-id'),
        contextSnapshots: [
          {
            ...buildRun().contextSnapshots[0],
            contextId: contextId('other-context'),
          },
          buildRun().contextSnapshots[1],
        ],
      }),
      buildRun({
        id: runId('bad-order'),
        contextSnapshots: [
          buildRun().contextSnapshots[1],
          buildRun().contextSnapshots[0],
        ],
      }),
      buildRun({
        ...existingRun,
        promptSnapshot: {
          promptId: promptId('other-prompt'),
          title: 'changed',
          body: 'changed',
        },
      }),
    ];

    for (const invalidRun of cases) {
      await expect(repository.saveRun(invalidRun)).rejects.toMatchObject(
        expectedRepositoryError('snapshot-mismatch'),
      );
    }

    await expect(repository.getRun(runId('bad-prompt'))).resolves.toBeNull();
    await expect(repository.getRun(existingRun.id)).resolves.toEqual(
      existingRun,
    );
  });

  it('lists active runs by project and updatedAt descending without status or parent revalidation', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const { project, recipe } = await seedProjectRecipe(repository, database);
    await repository.saveProject(buildProject({ id: projectId('project-2') }));
    await database.recipes.bulkPut([
      buildRecipe({
        id: recipeId('recipe-2'),
        projectId: projectId('project-2'),
      }),
    ]);
    const olderDraft = buildRun({
      id: runId('older-draft'),
      status: 'draft',
      updatedAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const newerFailed = buildRun({
      id: runId('newer-failed'),
      status: 'executed',
      evaluation: 'failed',
      updatedAt: utc('2026-07-06T03:00:00.000Z'),
    });
    const archived = buildRun({
      id: runId('archived'),
      archivedAt: utc('2026-07-06T04:00:00.000Z'),
      updatedAt: utc('2026-07-06T04:00:00.000Z'),
    });
    const otherProject = buildRun({
      id: runId('other-project-run'),
      projectId: projectId('project-2'),
      recipeId: recipeId('recipe-2'),
    });

    await Promise.all(
      [olderDraft, newerFailed, archived, otherProject].map((run) =>
        repository.saveRun(run),
      ),
    );
    await repository.saveProject({
      ...project,
      deletedAt: utc('2026-07-06T05:00:00.000Z'),
    });
    await database.recipes.put({
      ...recipe,
      deletedAt: utc('2026-07-06T06:00:00.000Z'),
    });

    await expect(repository.listActiveRuns(project.id)).resolves.toEqual([
      newerFailed,
      olderDraft,
    ]);
  });
});

describe('PromptTrailRepository link persistence', () => {
  it('saves, gets, lists, and soft deletes links in createdAt order without parent revalidation', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedProjectRecipe(repository, database);
    const run = buildRun();
    await repository.saveRun(run);
    const newer = buildLink({
      id: linkId('newer'),
      createdAt: utc('2026-07-06T03:00:00.000Z'),
    });
    const older = buildLink({
      id: linkId('older'),
      createdAt: utc('2026-07-06T01:00:00.000Z'),
    });
    const deleted = buildLink({
      id: linkId('deleted'),
      deletedAt: utc('2026-07-06T04:00:00.000Z'),
    });
    const otherRun = buildRun({ id: runId('other-run') });
    const otherRunLink = buildLink({
      id: linkId('other-run-link'),
      runId: otherRun.id,
    });

    await repository.saveRun(otherRun);
    await Promise.all(
      [newer, older, deleted, otherRunLink].map((link) =>
        repository.saveLink(link),
      ),
    );
    await expect(repository.getLink(newer.id)).resolves.toEqual(newer);
    await repository.softDeleteRun(run.id, utc('2026-07-06T05:00:00.000Z'));

    await expect(repository.listActiveLinks(run.id)).resolves.toEqual([
      older,
      newer,
    ]);
    await expect(
      repository.softDeleteLink(newer.id, utc('2026-07-06T06:00:00.000Z')),
    ).resolves.toEqual({
      ...newer,
      deletedAt: utc('2026-07-06T06:00:00.000Z'),
    });
    await expect(repository.getLink(newer.id)).resolves.toEqual({
      ...newer,
      deletedAt: utc('2026-07-06T06:00:00.000Z'),
    });
  });

  it('allows archived runs and rejects missing or deleted runs transactionally', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedProjectRecipe(repository, database);
    const run = buildRun({ archivedAt: utc('2026-07-06T03:00:00.000Z') });
    const existingLink = buildLink();

    await repository.saveRun(run);
    await expect(repository.saveLink(existingLink)).resolves.toEqual(
      existingLink,
    );
    await expect(
      repository.saveLink(
        buildLink({
          id: linkId('missing-run-link'),
          runId: runId('missing-run'),
        }),
      ),
    ).rejects.toMatchObject(expectedRepositoryError('reference-not-found'));
    await repository.softDeleteRun(run.id, utc('2026-07-06T04:00:00.000Z'));
    await expect(
      repository.saveLink(buildLink({ id: linkId('deleted-run-link') })),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));
    await expect(
      repository.saveLink({ ...existingLink, title: 'changed' }),
    ).rejects.toMatchObject(expectedRepositoryError('reference-unavailable'));

    await expect(
      repository.getLink(linkId('missing-run-link')),
    ).resolves.toBeNull();
    await expect(repository.getLink(existingLink.id)).resolves.toEqual(
      existingLink,
    );
  });

  it('reports not found for missing run and link soft deletes', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      repository.softDeleteRun(
        runId('missing-run'),
        utc('2026-07-06T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject(expectedRepositoryError('reference-not-found'));
    await expect(
      repository.softDeleteLink(
        linkId('missing-link'),
        utc('2026-07-06T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject(expectedRepositoryError('reference-not-found'));
  });
});
