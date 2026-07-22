import { afterEach, describe, expect, it } from 'vitest';

import type { Project, Prompt, Run, UtcDateTimeString } from '../domain';
import { DEFAULT_PROJECT_ID } from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { PromptTrailRepository } from './index';

const databaseScope = createDatabaseTestScope('direct-run-repository');
const timestamp = '2026-07-22T00:00:00.000Z' as UtcDateTimeString;

afterEach(async () => {
  await databaseScope.cleanup();
});

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: DEFAULT_PROJECT_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    archivedAt: null,
    name: 'Default Project',
    description: null,
    tags: [],
    repositoryUrl: null,
    ...overrides,
  };
}

function buildPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'direct-prompt' as Prompt['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    scope: 'project',
    projectId: DEFAULT_PROJECT_ID,
    title: 'Direct prompt',
    body: 'Create a Trail.',
    kind: 'codex-request',
    status: 'active',
    tags: [],
    ...overrides,
  } as Prompt;
}

function buildRun(
  prompt: Prompt,
  overrides: Partial<Run> = {},
): Run & { recipeId: null } {
  return {
    id: 'direct-run' as Run['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    recipeId: null,
    promptSnapshot: {
      promptId: prompt.id,
      title: prompt.title,
      body: prompt.body,
    },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: prompt.body,
    status: 'prepared',
    evaluation: null,
    improvementNote: null,
    ...overrides,
  } as Run & { recipeId: null };
}

describe('createDirectRunBundle', () => {
  it('atomically creates the missing default project, project Prompt, and Direct Run', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const prompt = buildPrompt();
    const run = buildRun(prompt);

    await expect(
      repository.createDirectRunBundle({
        project: buildProject(),
        prompt,
        run,
      }),
    ).resolves.toEqual({ project: buildProject(), prompt, run });
    await expect(repository.getRun(run.id)).resolves.toEqual(run);
    await expect(repository.getPrompt(prompt.id)).resolves.toEqual(prompt);
  });

  it('rolls back all records when Direct Run invariants are invalid', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const prompt = buildPrompt();
    const run = buildRun(prompt, { finalPrompt: 'different' });

    await expect(
      repository.createDirectRunBundle({
        project: buildProject(),
        prompt,
        run,
      }),
    ).rejects.toMatchObject({ code: 'snapshot-mismatch' });
    await expect(database.projects.count()).resolves.toBe(0);
    await expect(database.prompts.count()).resolves.toBe(0);
    await expect(database.runs.count()).resolves.toBe(0);
  });
});
