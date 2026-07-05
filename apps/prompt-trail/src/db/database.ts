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

    this.version(PROMPT_TRAIL_SCHEMA_VERSION).stores(schemaV1);
  }
}

export function createPromptTrailDatabase(name?: string): PromptTrailDatabase {
  return new PromptTrailDatabase(name);
}
