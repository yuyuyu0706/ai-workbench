import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { PROMPT_TRAIL_STORE_NAMES } from './metadata';
import { createPromptTrailDatabase } from './database';
import { migrateRunFromV1 } from './migrations/v1-to-v2';
import { migratePromptFromV2 } from './migrations/v2-to-v3';
import { migratePromptFromV3 } from './migrations/v3-to-v4';
import { migrateToV5 } from './migrations/v4-to-v5';

const LEGACY_STORE_NAMES = [
  'projects',
  'prompts',
  'contexts',
  'recipes',
  'runs',
  'links',
] as const;

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
  runs: object[] = [withTrailMetadata(legacyRun('active-direct', 'Active'))],
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

function withoutKind<T extends { kind?: unknown }>(prompt: T): Omit<T, 'kind'> {
  const clone: T = { ...prompt };
  delete clone.kind;
  return clone;
}

function withTrailMetadata<T extends { id: string; promptSnapshot: { title: string } }>(
  run: T,
) {
  return { ...run, trailTitle: run.promptSnapshot.title, trailKind: 'other' };
}

/** The final schema v5 shape of a Run migrated from a v1 legacy Run. */
function asMigratedRun<
  T extends { id: string; trailTitle?: string; trailKind?: string },
>(run: T) {
  const clone: Record<string, unknown> = { ...run };
  delete clone.trailTitle;
  delete clone.trailKind;
  return { ...clone, trailId: `trail-${run.id}` };
}

function expectedTrailFor(
  run: {
    id: string;
    projectId: string;
    promptSnapshot: { title: string };
    trailKind?: string;
  },
  now: string,
) {
  return {
    id: `trail-${run.id}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    archivedAt: null,
    projectId: run.projectId,
    title: run.promptSnapshot.title,
    kind: run.trailKind ?? 'other',
  };
}

async function readAllStores(
  database: Dexie,
  storeNames: readonly string[] = PROMPT_TRAIL_STORE_NAMES,
) {
  return Object.fromEntries(
    await Promise.all(
      storeNames.map(async (storeName) => [
        storeName,
        await database.table(storeName).orderBy('id').toArray(),
      ]),
    ),
  );
}

async function createLegacyDatabase(
  name: string,
  dataset: LegacyDataset,
  version = 1,
) {
  databaseNames.add(name);
  const database = new Dexie(name);
  database.version(1).stores(schemaV1);
  if (version >= 2) database.version(2).stores(schemaV1);
  if (version >= 3) database.version(3).stores(schemaV1);
  if (version >= 4) database.version(4).stores(schemaV1);
  await database.open();
  await database.transaction('rw', database.tables, async () =>
    Promise.all(
      LEGACY_STORE_NAMES.map((storeName) =>
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

  it('upgrades all Runs to the current schema and remains stable after reopening', async () => {
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
    expect(database.verno).toBe(5);
    for (const storeName of PROMPT_TRAIL_STORE_NAMES.filter(
      (storeName) =>
        storeName !== 'runs' &&
        storeName !== 'prompts' &&
        storeName !== 'projects' &&
        storeName !== 'workspaces' &&
        storeName !== 'trails',
    )) {
      expect(migrated[storeName]).toEqual(before[storeName]);
    }
    expect(migrated.projects).toEqual(
      before.projects.map((project) => ({
        ...project,
        workspaceId: 'prompt-trail-default-workspace',
      })),
    );
    expect(migrated.prompts).toEqual(
      before.prompts.map((prompt) => ({
        ...withoutKind(prompt),
        variableValues: {},
      })),
    );
    const sortedRuns = [...runs].sort((a, b) => a.id.localeCompare(b.id));
    expect(migrated.runs).toEqual(
      sortedRuns.map((run) => asMigratedRun(withTrailMetadata(run))),
    );
    expect(migrated.workspaces).toHaveLength(1);
    expect(migrated.workspaces[0]).toMatchObject({
      id: 'prompt-trail-default-workspace',
      name: 'Default Workspace',
    });
    expect(migrated.trails).toHaveLength(sortedRuns.length);
    for (const run of sortedRuns) {
      const trail = migrated.trails.find((candidate: { id: string }) => candidate.id === `trail-${run.id}`);
      expect(trail).toMatchObject({
        projectId: run.projectId,
        title: run.promptSnapshot.title,
        kind: 'other',
      });
    }
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
    expect(await readAllStores(legacy, LEGACY_STORE_NAMES)).toEqual(before);
    legacy.close();
  });
});

describe('schema v2 to v3 migration', () => {
  it('adds an empty variableValues without changing other Prompt fields', () => {
    const prompt = {
      id: 'prompt-1',
      scope: 'project',
      projectId: 'project-1',
      title: 'Prompt title',
      body: 'Body ${var}',
      kind: 'other',
      status: 'active',
      tags: [],
      createdAt,
      updatedAt,
      deletedAt: null,
    };
    const before = structuredClone(prompt);
    migratePromptFromV2(prompt as { variableValues?: Record<string, string> });
    expect(prompt).toEqual({ ...before, variableValues: {} });
  });

  it('upgrades all Prompts to v3 while preserving every unrelated store', async () => {
    const name = `prompt-trail-migration-v3-${crypto.randomUUID()}`;
    const before = legacyDataset();
    await createLegacyDatabase(name, before, 2);

    const database = createPromptTrailDatabase(name);
    await database.open();
    const migrated = await readAllStores(database);
    expect(database.verno).toBe(5);
    for (const storeName of PROMPT_TRAIL_STORE_NAMES.filter(
      (storeName) =>
        storeName !== 'prompts' &&
        storeName !== 'runs' &&
        storeName !== 'projects' &&
        storeName !== 'workspaces' &&
        storeName !== 'trails',
    )) {
      expect(migrated[storeName]).toEqual(before[storeName]);
    }
    expect(migrated.projects).toEqual(
      before.projects.map((project) => ({
        ...project,
        workspaceId: 'prompt-trail-default-workspace',
      })),
    );
    expect(migrated.prompts).toEqual(
      before.prompts.map((prompt) => ({
        ...withoutKind(prompt),
        variableValues: {},
      })),
    );
    database.close();

    const reopened = createPromptTrailDatabase(name);
    await reopened.open();
    expect(await readAllStores(reopened)).toEqual(migrated);
    reopened.close();
  });
});

describe('schema v3 to v4 migration', () => {
  it.each([
    ['chat-consultation', 'チャット相談'],
    ['codex-request', 'Codex依頼'],
    ['issue-creation', 'Issue作成'],
    ['design-review', '設計レビュー'],
    ['incident-analysis', '障害分析'],
  ])('migrates kind %s into the %s tag', (kind, label) => {
    const prompt = {
      id: 'prompt-1',
      scope: 'project',
      projectId: 'project-1',
      title: 'Prompt title',
      body: 'Body ${var}',
      kind,
      status: 'active',
      tags: [] as string[],
      variableValues: {},
      createdAt,
      updatedAt,
      deletedAt: null,
    };
    const before = structuredClone(prompt);
    delete (before as { kind?: string }).kind;
    migratePromptFromV3(prompt);
    expect(prompt).toEqual({ ...before, tags: [label] });
  });

  it('does not add a tag for kind other', () => {
    const prompt = {
      id: 'prompt-1',
      kind: 'other',
      tags: [] as string[],
    };
    const before = structuredClone(prompt);
    delete (before as { kind?: string }).kind;
    migratePromptFromV3(prompt);
    expect(prompt).toEqual(before);
  });

  it('appends to existing tags and skips duplicates', () => {
    const prompt = {
      id: 'prompt-1',
      kind: 'codex-request',
      tags: ['既存タグ', 'Codex依頼'],
    };
    migratePromptFromV3(prompt);
    expect(prompt.tags).toEqual(['既存タグ', 'Codex依頼']);
  });

  it('upgrades all Prompts to v4 while preserving every unrelated store', async () => {
    const name = `prompt-trail-migration-v4-${crypto.randomUUID()}`;
    const seed = legacyDataset([withTrailMetadata(legacyRun('active-direct', 'Active'))]);
    const seededPrompt = {
      ...seed.prompts[0],
      kind: 'design-review',
      variableValues: {},
    };
    const before = { ...seed, prompts: [seededPrompt] };
    await createLegacyDatabase(name, before, 3);

    const database = createPromptTrailDatabase(name);
    await database.open();
    const migrated = await readAllStores(database);
    expect(database.verno).toBe(5);
    for (const storeName of PROMPT_TRAIL_STORE_NAMES.filter(
      (storeName) =>
        storeName !== 'prompts' &&
        storeName !== 'runs' &&
        storeName !== 'projects' &&
        storeName !== 'workspaces' &&
        storeName !== 'trails',
    )) {
      expect(migrated[storeName]).toEqual(before[storeName]);
    }
    expect(migrated.projects).toEqual(
      before.projects.map((project) => ({
        ...project,
        workspaceId: 'prompt-trail-default-workspace',
      })),
    );
    expect(migrated.prompts).toEqual(
      before.prompts.map((prompt) => ({
        ...withoutKind(prompt),
        tags: [...prompt.tags, '設計レビュー'],
      })),
    );
    database.close();

    const reopened = createPromptTrailDatabase(name);
    await reopened.open();
    expect(await readAllStores(reopened)).toEqual(migrated);
    reopened.close();
  });
});

describe('schema v4 to v5 migration', () => {
  it('creates one Trail per Run and points Run.trailId at it, without changing other fields', async () => {
    const now = '2026-02-01T00:00:00.000Z';
    const runA = withTrailMetadata(legacyRun('run-a', 'Trail A'));
    const runB = {
      ...withTrailMetadata(legacyRun('run-b', 'Trail B')),
      trailKind: 'development',
    };
    const workspaces: Record<string, unknown[]> = { workspaces: [] };
    const projects: Record<string, unknown[]> = {
      projects: [{ id: 'project-1', name: 'Legacy project' }],
    };
    const trails: Record<string, unknown[]> = { trails: [] };
    const runs: Record<string, unknown>[] = [
      structuredClone(runA),
      structuredClone(runB),
    ];

    const projectRecords = projects.projects as Record<string, unknown>[];
    const fakeTables: Record<string, unknown> = {
      workspaces: fakeTable(workspaces, 'workspaces'),
      projects: fakeModifiableTable(projectRecords),
      trails: fakeTable(trails, 'trails'),
      runs: fakeModifiableTable(runs),
    };
    const fakeTx = {
      table: (name: string) => fakeTables[name],
    } as Parameters<typeof migrateToV5>[0];

    const realNow = Date;
    class FixedDate extends Date {
      constructor() {
        super(now);
      }
    }
    globalThis.Date = FixedDate as DateConstructor;
    try {
      await migrateToV5(fakeTx);
    } finally {
      globalThis.Date = realNow;
    }

    expect(workspaces.workspaces).toHaveLength(1);
    expect(workspaces.workspaces[0]).toMatchObject({
      id: 'prompt-trail-default-workspace',
      name: 'Default Workspace',
    });
    expect(trails.trails).toEqual([
      expectedTrailFor(runA, now),
      expectedTrailFor(runB, now),
    ]);
    expect(runs).toEqual([
      asMigratedRun(runA),
      asMigratedRun(runB),
    ]);
  });

  it('upgrades a real database end to end and remains stable after reopening', async () => {
    const name = `prompt-trail-migration-v5-${crypto.randomUUID()}`;
    const runs = [withTrailMetadata(legacyRun('active-direct', 'Active'))];
    const before = legacyDataset(runs);
    await createLegacyDatabase(name, before, 4);

    const database = createPromptTrailDatabase(name);
    await database.open();
    const migrated = await readAllStores(database);
    expect(database.verno).toBe(5);
    expect(migrated.workspaces).toHaveLength(1);
    expect(migrated.trails).toHaveLength(1);
    expect(migrated.trails[0]).toMatchObject({
      projectId: 'project-1',
      title: 'Active',
      kind: 'other',
    });
    expect(migrated.runs[0]).toMatchObject({
      id: 'active-direct',
      trailId: migrated.trails[0].id,
    });
    expect(migrated.runs[0]).not.toHaveProperty('trailTitle');
    expect(migrated.runs[0]).not.toHaveProperty('trailKind');
    database.close();

    const reopened = createPromptTrailDatabase(name);
    await reopened.open();
    expect(await readAllStores(reopened)).toEqual(migrated);
    reopened.close();
  });

  it('rolls back every store, including workspaces and prior stores, when a Run is missing trail metadata', async () => {
    const name = `prompt-trail-migration-v5-rollback-${crypto.randomUUID()}`;
    const malformed = legacyRun('missing-metadata', 'Untitled');
    const before = legacyDataset([malformed]);
    await createLegacyDatabase(name, before, 4);

    const current = createPromptTrailDatabase(name);
    await expect(current.open()).rejects.toThrow(
      'Legacy Run must contain trailTitle and trailKind',
    );
    current.close();

    const legacy = new Dexie(name);
    legacy.version(1).stores(schemaV1);
    await legacy.open();
    expect(await readAllStores(legacy, LEGACY_STORE_NAMES)).toEqual(before);
    legacy.close();
  });
});

function fakeTable(
  store: Record<string, unknown[]>,
  key: string,
): { add: (record: unknown) => Promise<void> } {
  return {
    add: async (record: unknown) => {
      store[key].push(record);
    },
  };
}

function fakeModifiableTable(records: Record<string, unknown>[]): {
  toArray: () => Promise<Record<string, unknown>[]>;
  toCollection: () => {
    modify: (mutator: (record: Record<string, unknown>) => void) => Promise<void>;
  };
} {
  return {
    toArray: async () => records,
    toCollection: () => ({
      modify: async (mutator) => {
        for (const record of records) mutator(record);
      },
    }),
  };
}
