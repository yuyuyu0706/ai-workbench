import Dexie, { type Table } from 'dexie';

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
  PROMPT_TRAIL_DB_NAME,
  PROMPT_TRAIL_SCHEMA_VERSION,
  type PromptTrailStoreName,
} from './metadata';
import { migrateRunFromV1 } from './migrations/v1-to-v2';
import { migratePromptFromV2 } from './migrations/v2-to-v3';

const schemaV1 = {
  projects: 'id, updatedAt, archivedAt, deletedAt',
  prompts: 'id, scope, projectId, status, updatedAt, deletedAt',
  contexts: 'id, scope, projectId, status, updatedAt, deletedAt',
  recipes: 'id, projectId, promptId, updatedAt, deletedAt',
  runs: 'id, projectId, recipeId, status, updatedAt, archivedAt, deletedAt',
  links: 'id, runId, createdAt, deletedAt',
} satisfies Record<PromptTrailStoreName, string>;

export class PromptTrailDatabase extends Dexie {
  projects!: Table<Project, ProjectId>;
  prompts!: Table<Prompt, PromptId>;
  contexts!: Table<Context, ContextId>;
  recipes!: Table<Recipe, RecipeId>;
  runs!: Table<Run, RunId>;
  links!: Table<Link, LinkId>;

  constructor(name = PROMPT_TRAIL_DB_NAME) {
    super(name);

    // Keep the historical schema registrations as the upgrade starting points.
    this.version(1).stores(schemaV1);
    this.version(2)
      .stores(schemaV1)
      .upgrade((transaction) =>
        transaction.table('runs').toCollection().modify(migrateRunFromV1),
      );
    this.version(PROMPT_TRAIL_SCHEMA_VERSION)
      .stores(schemaV1)
      .upgrade((transaction) =>
        transaction.table('prompts').toCollection().modify(migratePromptFromV2),
      );
  }
}

export function createPromptTrailDatabase(name?: string): PromptTrailDatabase {
  return new PromptTrailDatabase(name);
}
