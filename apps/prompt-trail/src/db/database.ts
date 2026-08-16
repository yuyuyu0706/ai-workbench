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
  Trail,
  TrailId,
  Workspace,
  WorkspaceId,
} from '../domain';

import {
  PROMPT_TRAIL_DB_NAME,
  PROMPT_TRAIL_SCHEMA_VERSION,
  type PromptTrailStoreName,
} from './metadata';
import { migrateRunFromV1 } from './migrations/v1-to-v2';
import { migratePromptFromV2 } from './migrations/v2-to-v3';
import { migratePromptFromV3 } from './migrations/v3-to-v4';
import { migrateToV5 } from './migrations/v4-to-v5';
// v5-to-v6 is a schema-only change (adds the runs.trailId index); see
// ./migrations/v5-to-v6.ts for why no data migration is needed.
import { migrateToV7 } from './migrations/v6-to-v7';

const schemaV0 = {
  projects: 'id, updatedAt, archivedAt, deletedAt',
  prompts: 'id, scope, projectId, status, updatedAt, deletedAt',
  contexts: 'id, scope, projectId, status, updatedAt, deletedAt',
  recipes: 'id, projectId, promptId, updatedAt, deletedAt',
  runs: 'id, projectId, recipeId, status, updatedAt, archivedAt, deletedAt',
  links: 'id, runId, createdAt, deletedAt',
};

const schemaV5 = {
  ...schemaV0,
  workspaces: 'id, updatedAt, deletedAt',
  trails: 'id, projectId, updatedAt, deletedAt',
} satisfies Record<PromptTrailStoreName, string>;

const schemaV6 = {
  ...schemaV5,
  runs: 'id, projectId, recipeId, trailId, status, updatedAt, archivedAt, deletedAt',
} satisfies Record<PromptTrailStoreName, string>;

export class PromptTrailDatabase extends Dexie {
  workspaces!: Table<Workspace, WorkspaceId>;
  projects!: Table<Project, ProjectId>;
  prompts!: Table<Prompt, PromptId>;
  contexts!: Table<Context, ContextId>;
  recipes!: Table<Recipe, RecipeId>;
  runs!: Table<Run, RunId>;
  links!: Table<Link, LinkId>;
  trails!: Table<Trail, TrailId>;

  constructor(name = PROMPT_TRAIL_DB_NAME) {
    super(name);

    // Keep the historical schema registrations as the upgrade starting points.
    this.version(1).stores(schemaV0);
    this.version(2)
      .stores(schemaV0)
      .upgrade((transaction) =>
        transaction.table('runs').toCollection().modify(migrateRunFromV1),
      );
    this.version(3)
      .stores(schemaV0)
      .upgrade((transaction) =>
        transaction.table('prompts').toCollection().modify(migratePromptFromV2),
      );
    this.version(4)
      .stores(schemaV0)
      .upgrade((transaction) =>
        transaction.table('prompts').toCollection().modify(migratePromptFromV3),
      );
    this.version(5)
      .stores(schemaV5)
      .upgrade((transaction) => migrateToV5(transaction));
    this.version(6).stores(schemaV6);
    this.version(PROMPT_TRAIL_SCHEMA_VERSION)
      .stores(schemaV6)
      .upgrade((transaction) => migrateToV7(transaction));
  }
}

export function createPromptTrailDatabase(name?: string): PromptTrailDatabase {
  return new PromptTrailDatabase(name);
}
