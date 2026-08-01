import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { PROMPT_TRAIL_STORE_NAMES } from './metadata';
import { createPromptTrailDatabase } from './database';
import { migrateRunFromV1 } from './migrations/v1-to-v2';

const schemaV1 = {
  projects: 'id, updatedAt, archivedAt, deletedAt',
  prompts: 'id, scope, projectId, status, updatedAt, deletedAt',
  contexts: 'id, scope, projectId, status, updatedAt, deletedAt',
  recipes: 'id, projectId, promptId, updatedAt, deletedAt',
  runs: 'id, projectId, recipeId, status, updatedAt, archivedAt, deletedAt',
  links: 'id, runId, createdAt, deletedAt',
};

const createdAt = '2026-01-01T00:00:00.000Z';
const updatedAt = '2026-01-02T00:00:00.000Z';

function legacyRun(id: string, title: string) {
  return {
    id,
    projectId: 'project-1',
    recipeId: null,
    promptSnapshot: { promptId: 'prompt-1', title, body: 'Prompt body' },
    contextSnapshots: [
      { contextId: 'context-1', title: 'Context title', body: 'Context body' },
    ],
    inputValues: { target: 'migration' },
    finalPrompt: 'Context body\n\nPrompt body',
    status: 'done',
    evaluation: 'good',
    improvementNote: 'Keep every legacy field unchanged.',
    createdAt,
    updatedAt,
    deletedAt: null,
    archivedAt: null,
  };
}

function legacyDataset(
  runs: object[] = [legacyRun('active-direct', 'Active')],
) {
  return {
    projects: [
      {
        id: 'project-1',
        name: 'Legacy project',
        description: null,
        tags: ['legacy'],
        repositoryUrl: null,
        createdAt,
        updatedAt,
        deletedAt: null,
        archivedAt: null,
      },
    ],
    prompts: [
      {
        id: 'prompt-1',
        scope: 'project',
        projectId: 'project-1',
        title: 'Prompt title',
        body: 'Prompt body',
        kind: 'other',
        status: 'active',
        tags: [],
        createdAt,
        updatedAt,
        deletedAt: null,
      },
    ],
    contexts: [
      {
        id: 'context-1',
        scope: 'project',
        projectId: 'project-1',
        title: 'Context title',
        body: 'Context body',
        kind: 'other',
        status: 'enabled',
        tags: [],
        createdAt,
        updatedAt,
        deletedAt: null,
      },
    ],
    recipes: [
      {
        id: 'recipe-1',
        projectId: 'project-1',
        title: 'Legacy recipe',
        description: null,
        promptId: 'prompt-1',
        contextIds: ['context-1'],
        createdAt,
        updatedAt,
        deletedAt: null,
      },
    ],
    runs,
    links: [
      {
        id: 'link-1',
        runId: 'active-direct',
        url: 'https://example.com/result',
        title: 'Legacy result',
        type: 'document',
        role: 'result',
        summary: null,
        externalId: null,
        createdAt,
        updatedAt,
        deletedAt: null,
      },
    ],
  };
}

type LegacyDataset = ReturnType<typeof legacyDataset>;
const databaseNames = new Set<string>();

async function readAllStores(database: Dexie) {
  return Object.fromEntries(
    await Promise.all(
      PROMPT_TRAIL_STORE_NAMES.map(async (storeName) => [
        storeName,
        await database.table(storeName).orderBy('id').toArray(),
      ]),
    ),
  );
}

async function createLegacyDatabase(name: string, dataset: LegacyDataset) {
  databaseNames.add(name);
  const database = new Dexie(name);
  database.version(1).stores(schemaV1);
  await database.open();
  await database.transaction('rw', database.tables, async () =>
    Promise.all(
      PROMPT_TRAIL_STORE_NAMES.map((storeName) =>
        database.table(storeName).bulkAdd(dataset[storeName]),
      ),
    ),
  );
  database.close();
}

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => Dexie.delete(name)));
  databaseNames.clear();
});

describe('schema v1 to v2 migration', () => {
  it('copies the exact snapshot title and adds other without changing legacy fields', () => {
    const run = legacyRun('run-1', '  Exact legacy title  ');
    const before = structuredClone(run);
    migrateRunFromV1(run);
    expect(run).toEqual({
      ...before,
      trailTitle: '  Exact legacy title  ',
      trailKind: 'other',
    });
  });

  it('upgrades all Runs while preserving all six stores and remains stable after reopening', async () => {
    const name = `prompt-trail-migration-${crypto.randomUUID()}`;
    const runs = [
      legacyRun('active-direct', 'Active'),
      {
        ...legacyRun('archived-recipe', 'Archived'),
        recipeId: 'recipe-1',
        archivedAt: '2026-01-03T00:00:00.000Z',
      },
      {
        ...legacyRun('deleted-direct', 'Deleted'),
        deletedAt: '2026-01-04T00:00:00.000Z',
      },
    ];
    const before = legacyDataset(runs);
    await createLegacyDatabase(name, before);

    const database = createPromptTrailDatabase(name);
    await database.open();
    const migrated = await readAllStores(database);
    expect(database.verno).toBe(2);
    for (const storeName of PROMPT_TRAIL_STORE_NAMES.filter(
      (storeName) => storeName !== 'runs',
    )) {
      expect(migrated[storeName]).toEqual(before[storeName]);
    }
    expect(migrated.runs).toEqual(
      [...runs]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((run) => ({
          ...run,
          trailTitle: run.promptSnapshot.title,
          trailKind: 'other',
        })),
    );
    expect(migrated.links[0]).toMatchObject({ runId: 'active-direct' });
    database.close();

    const reopened = createPromptTrailDatabase(name);
    await reopened.open();
    expect(await readAllStores(reopened)).toEqual(migrated);
    reopened.close();
  });

  it('rolls back every store when a malformed Run rejects the upgrade', async () => {
    const name = `prompt-trail-migration-rollback-${crypto.randomUUID()}`;
    const malformed = {
      ...legacyRun('z-malformed', 'Invalid'),
      promptSnapshot: undefined,
    };
    const before = legacyDataset([
      legacyRun('active-direct', 'Valid'),
      malformed,
    ]);
    await createLegacyDatabase(name, before);

    const current = createPromptTrailDatabase(name);
    await expect(current.open()).rejects.toThrow(
      'Legacy Run must contain a Prompt Snapshot title.',
    );
    current.close();

    const legacy = new Dexie(name);
    legacy.version(1).stores(schemaV1);
    await legacy.open();
    expect(await readAllStores(legacy)).toEqual(before);
    legacy.close();
  });
});
