import type { Table } from 'dexie';
import { describe, expect, it } from 'vitest';

import type {
  Context,
  ContextId,
  Link,
  LinkId,
  Project,
  ProjectId,
  Prompt,
  PromptId,
  Recipe,
  RecipeId,
  Run,
  RunId,
  Trail,
  TrailId,
  Workspace,
  WorkspaceId,
} from '../domain';

import {
  createPromptTrailDatabase,
  PROMPT_TRAIL_DB_NAME,
  PromptTrailDatabase,
  PROMPT_TRAIL_SCHEMA_VERSION,
  PROMPT_TRAIL_STORE_NAMES,
  type PromptTrailStoreName,
} from './index';

const expectedIndexes = {
  projects: ['updatedAt', 'archivedAt', 'deletedAt'],
  prompts: ['scope', 'projectId', 'status', 'updatedAt', 'deletedAt'],
  contexts: ['scope', 'projectId', 'status', 'updatedAt', 'deletedAt'],
  recipes: ['projectId', 'promptId', 'updatedAt', 'deletedAt'],
  runs: [
    'projectId',
    'recipeId',
    'trailId',
    'promptSnapshot.promptId',
    'status',
    'updatedAt',
    'archivedAt',
    'deletedAt',
  ],
  links: ['runId', 'createdAt', 'deletedAt'],
  workspaces: ['updatedAt', 'deletedAt'],
  trails: ['projectId', 'updatedAt', 'deletedAt'],
} satisfies Record<PromptTrailStoreName, string[]>;

type PromptTrailTables = {
  projects: Table<Project, ProjectId>;
  prompts: Table<Prompt, PromptId>;
  contexts: Table<Context, ContextId>;
  recipes: Table<Recipe, RecipeId>;
  runs: Table<Run, RunId>;
  links: Table<Link, LinkId>;
  workspaces: Table<Workspace, WorkspaceId>;
  trails: Table<Trail, TrailId>;
};

function expectTypedTables(database: PromptTrailDatabase): PromptTrailTables {
  return {
    projects: database.projects,
    prompts: database.prompts,
    contexts: database.contexts,
    recipes: database.recipes,
    runs: database.runs,
    links: database.links,
    workspaces: database.workspaces,
    trails: database.trails,
  };
}

describe('PromptTrailDatabase schema v3', () => {
  it('creates PromptTrailDatabase instances with the default and custom DB names', () => {
    const defaultDatabase = createPromptTrailDatabase();
    const customDatabase = createPromptTrailDatabase(
      'prompt-trail-schema-test',
    );

    expect(defaultDatabase).toBeInstanceOf(PromptTrailDatabase);
    expect(defaultDatabase.name).toBe(PROMPT_TRAIL_DB_NAME);
    expect(customDatabase).toBeInstanceOf(PromptTrailDatabase);
    expect(customDatabase.name).toBe('prompt-trail-schema-test');
  });

  it('registers the schema version from the metadata contract', () => {
    const database = createPromptTrailDatabase(
      'prompt-trail-schema-version-test',
    );

    expect(database.verno).toBe(PROMPT_TRAIL_SCHEMA_VERSION);
    expect(PROMPT_TRAIL_SCHEMA_VERSION).toBe(9);
  });

  it('registers the eight metadata store names only', () => {
    const database = createPromptTrailDatabase('prompt-trail-store-name-test');

    expect(database.tables.map((table) => table.name)).toEqual(
      PROMPT_TRAIL_STORE_NAMES,
    );
  });

  it('uses id as the primary key for every store', () => {
    const database = createPromptTrailDatabase('prompt-trail-primary-key-test');

    for (const storeName of PROMPT_TRAIL_STORE_NAMES) {
      expect(database.table(storeName).schema.primKey.name).toBe('id');
    }
  });

  it('preserves the exact minimum indexes for each store', () => {
    const database = createPromptTrailDatabase('prompt-trail-index-test');

    for (const storeName of PROMPT_TRAIL_STORE_NAMES) {
      expect(
        database.table(storeName).schema.indexes.map((index) => index.name),
      ).toEqual(expectedIndexes[storeName]);
    }
  });

  it('exposes typed tables for all domain models through the DB class', () => {
    const database = createPromptTrailDatabase('prompt-trail-typed-table-test');

    expect(Object.keys(expectTypedTables(database))).toEqual(
      PROMPT_TRAIL_STORE_NAMES,
    );
  });
});
