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
    'status',
    'updatedAt',
    'archivedAt',
    'deletedAt',
  ],
  links: ['runId', 'createdAt', 'deletedAt'],
} satisfies Record<PromptTrailStoreName, string[]>;

type PromptTrailTables = {
  projects: Table<Project, ProjectId>;
  prompts: Table<Prompt, PromptId>;
  contexts: Table<Context, ContextId>;
  recipes: Table<Recipe, RecipeId>;
  runs: Table<Run, RunId>;
  links: Table<Link, LinkId>;
};

function expectTypedTables(database: PromptTrailDatabase): PromptTrailTables {
  return {
    projects: database.projects,
    prompts: database.prompts,
    contexts: database.contexts,
    recipes: database.recipes,
    runs: database.runs,
    links: database.links,
  };
}

describe('PromptTrailDatabase schema v1', () => {
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

  it('registers only schema version 1 from the metadata contract', () => {
    const database = createPromptTrailDatabase(
      'prompt-trail-schema-version-test',
    );

    expect(database.verno).toBe(PROMPT_TRAIL_SCHEMA_VERSION);
  });

  it('registers the six metadata store names only', () => {
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

  it('registers the exact schema v1 minimum indexes for each store', () => {
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
