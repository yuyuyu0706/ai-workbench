import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

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

const databaseNames = new Set<string>();

function legacyRun(id: string, title: string) {
  return {
    id,
    projectId: 'project-1',
    recipeId: null,
    promptSnapshot: { promptId: 'prompt-1', title, body: 'Body' },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: 'Body',
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  };
}

async function createLegacyDatabase(name: string, runs: object[]) {
  databaseNames.add(name);
  const database = new Dexie(name);
  database.version(1).stores(schemaV1);
  await database.open();
  await database.table('runs').bulkAdd(runs);
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

  it('upgrades every Run and remains stable after reopening', async () => {
    const name = `prompt-trail-migration-${crypto.randomUUID()}`;
    const legacyRuns = [
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
    await createLegacyDatabase(name, legacyRuns);

    const database = createPromptTrailDatabase(name);
    await database.open();
    const migrated = await database.runs.orderBy('id').toArray();
    expect(database.verno).toBe(2);
    expect(migrated).toEqual(
      [...legacyRuns]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((run) => ({
          ...run,
          trailTitle: run.promptSnapshot.title,
          trailKind: 'other',
        })),
    );
    database.close();

    const reopened = createPromptTrailDatabase(name);
    await reopened.open();
    expect(await reopened.runs.orderBy('id').toArray()).toEqual(migrated);
    reopened.close();
  });

  it('rolls back all changes when a malformed Run rejects the upgrade', async () => {
    const name = `prompt-trail-migration-rollback-${crypto.randomUUID()}`;
    const valid = legacyRun('a-valid', 'Valid');
    const malformed = {
      ...legacyRun('z-malformed', 'Invalid'),
      promptSnapshot: undefined,
    };
    await createLegacyDatabase(name, [valid, malformed]);

    const current = createPromptTrailDatabase(name);
    await expect(current.open()).rejects.toThrow(
      'Legacy Run must contain a Prompt Snapshot title.',
    );
    current.close();

    const legacy = new Dexie(name);
    legacy.version(1).stores(schemaV1);
    await legacy.open();
    expect(await legacy.table('runs').get(valid.id)).toEqual(valid);
    expect(await legacy.table('runs').get(malformed.id)).toEqual(malformed);
    legacy.close();
  });
});
