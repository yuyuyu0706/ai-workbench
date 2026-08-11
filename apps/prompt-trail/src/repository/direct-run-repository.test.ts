import { afterEach, describe, expect, it } from 'vitest';

import type { Project, Prompt, Run, UtcDateTimeString } from '../domain';
import { createDefaultProject, DEFAULT_PROJECT_ID } from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';

import { PromptTrailRepository } from './index';

const databaseScope = createDatabaseTestScope('direct-run-repository');
const timestamp = '2026-07-22T00:00:00.000Z' as UtcDateTimeString;

afterEach(async () => {
  await databaseScope.cleanup();
});

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    ...createDefaultProject(timestamp),
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
    status: 'active',
    tags: [],
    ...overrides,
  } as Prompt;
}

function buildRun(
  prompt: Prompt,
  overrides: Partial<Run & { recipeId: null }> = {},
): Run & { recipeId: null } {
  return {
    id: 'direct-run' as Run['id'],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    trailTitle: prompt.title,
    trailKind: 'other',
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
  };
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
    await expect(repository.getRun(run.id)).resolves.toMatchObject({
      trailTitle: prompt.title,
      trailKind: 'other',
    });
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

  it.each([
    [
      'bundle Prompt belongs to another Project',
      { projectId: 'other-project' as Project['id'] },
      {},
      'project-mismatch',
    ],
    [
      'Run belongs to another Project',
      {},
      { projectId: 'other-project' as Project['id'] },
      'project-mismatch',
    ],
    [
      'Prompt Snapshot references another Prompt',
      {},
      {
        promptSnapshot: {
          promptId: 'other-prompt' as Prompt['id'],
          title: 'Direct prompt',
          body: 'Create a Trail.',
        },
      },
      'snapshot-mismatch',
    ],
    ['Prompt is global', { scope: 'global' as const }, {}, 'project-mismatch'],
    [
      'Prompt is deleted',
      { deletedAt: timestamp },
      {},
      'reference-unavailable',
    ],
    [
      'Prompt is deprecated',
      { status: 'deprecated' as const },
      {},
      'reference-unavailable',
    ],
    [
      'Snapshot title differs',
      {},
      {
        promptSnapshot: {
          promptId: 'direct-prompt' as Prompt['id'],
          title: 'other',
          body: 'Create a Trail.',
        },
      },
      'snapshot-mismatch',
    ],
    [
      'Snapshot body differs',
      {},
      {
        promptSnapshot: {
          promptId: 'direct-prompt' as Prompt['id'],
          title: 'Direct prompt',
          body: 'other',
        },
      },
      'snapshot-mismatch',
    ],
    [
      'Context snapshots are not empty',
      {},
      {
        contextSnapshots: [
          { contextId: 'context' as never, title: 'Context', body: 'Body' },
        ],
      },
      'snapshot-mismatch',
    ],
    [
      'Input values are not empty',
      {},
      { inputValues: { value: 'x' } },
      'snapshot-mismatch',
    ],
  ])(
    'rolls back when %s',
    async (_name, promptOverrides, runOverrides, code) => {
      const database = databaseScope.createDatabase();
      const repository = new PromptTrailRepository(database);
      const prompt = buildPrompt(promptOverrides);
      const run = buildRun(prompt, runOverrides);

      await expect(
        repository.createDirectRunBundle({
          project: buildProject(),
          prompt,
          run,
        }),
      ).rejects.toMatchObject({ code });
      await expect(database.projects.count()).resolves.toBe(0);
      await expect(database.prompts.count()).resolves.toBe(0);
      await expect(database.runs.count()).resolves.toBe(0);
    },
  );

  it('rejects a Run that references an existing Prompt instead of bundle Prompt', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const existingPrompt = buildPrompt({
      id: 'existing-prompt' as Prompt['id'],
    });
    await repository.saveProject(buildProject());
    await repository.savePrompt(existingPrompt);
    const prompt = buildPrompt();
    const run = buildRun(prompt, {
      promptSnapshot: {
        promptId: existingPrompt.id,
        title: existingPrompt.title,
        body: existingPrompt.body,
      },
    });

    await expect(
      repository.createDirectRunBundle({
        project: buildProject(),
        prompt,
        run,
      }),
    ).rejects.toMatchObject({ code: 'snapshot-mismatch' });
    await expect(database.prompts.count()).resolves.toBe(1);
    await expect(database.runs.count()).resolves.toBe(0);
  });

  it.each(['prompt', 'run'] as const)(
    'rejects duplicate Direct Run %s IDs',
    async (duplicate) => {
      const database = databaseScope.createDatabase();
      const repository = new PromptTrailRepository(database);
      const prompt = buildPrompt();
      const run = buildRun(prompt);
      await repository.createDirectRunBundle({
        project: buildProject(),
        prompt,
        run,
      });
      const nextPrompt = buildPrompt({
        id:
          duplicate === 'prompt' ? prompt.id : ('next-prompt' as Prompt['id']),
      });
      const nextRun = buildRun(nextPrompt, {
        id: duplicate === 'run' ? run.id : ('next-run' as Run['id']),
      });
      await expect(
        repository.createDirectRunBundle({
          project: buildProject(),
          prompt: nextPrompt,
          run: nextRun,
        }),
      ).rejects.toMatchObject({ code: 'duplicate-id' });
    },
  );

  it.each(['deletedAt', 'archivedAt'] as const)(
    'rejects an unavailable existing default Project (%s)',
    async (field) => {
      const database = databaseScope.createDatabase();
      const repository = new PromptTrailRepository(database);
      await repository.saveProject(buildProject({ [field]: timestamp }));
      const prompt = buildPrompt();
      const run = buildRun(prompt);
      await expect(
        repository.createDirectRunBundle({
          project: buildProject(),
          prompt,
          run,
        }),
      ).rejects.toMatchObject({ code: 'reference-unavailable' });
      await expect(database.prompts.count()).resolves.toBe(0);
    },
  );
});

describe('createDirectRunFromPrompt', () => {
  it.each(['project', 'global'] as const)(
    'atomically creates only a Run from an existing %s Prompt',
    async (scope) => {
      const database = databaseScope.createDatabase();
      const repository = new PromptTrailRepository(database);
      const project = buildProject();
      const projectPrompt = buildPrompt();
      const globalPrompt = structuredClone(projectPrompt) as Prompt & {
        projectId?: Project['id'];
      };
      delete globalPrompt.projectId;
      const prompt =
        scope === 'global'
          ? ({ ...globalPrompt, scope: 'global' } as Prompt)
          : projectPrompt;
      if (scope === 'project') await repository.saveProject(project);
      await repository.savePrompt(prompt);
      const run = buildRun(prompt);
      const before = structuredClone(prompt);

      await expect(
        repository.createDirectRunFromPrompt({
          project,
          promptId: prompt.id,
          expectedPromptUpdatedAt: prompt.updatedAt,
          run,
        }),
      ).resolves.toEqual({ project, run });
      await expect(repository.getPrompt(prompt.id)).resolves.toEqual(before);
      await expect(database.prompts.count()).resolves.toBe(1);
      await expect(database.runs.count()).resolves.toBe(1);
    },
  );

  it.each([
    ['stale-write', { expectedPromptUpdatedAt: '2026-01-02T00:00:00.000Z' }],
    ['snapshot-mismatch', { run: { finalPrompt: 'changed' } }],
    ['project-mismatch', { prompt: { projectId: 'other-project' } }],
  ])('rolls back the Run on %s', async (code, overrides) => {
    const scenario = overrides as {
      prompt?: Partial<Prompt>;
      run?: Partial<Run & { recipeId: null }>;
      expectedPromptUpdatedAt?: string;
    };
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    const project = buildProject();
    await repository.saveProject(project);
    const prompt = buildPrompt(scenario.prompt);
    await database.prompts.add(prompt);
    const run = buildRun(prompt, scenario.run);

    await expect(
      repository.createDirectRunFromPrompt({
        project,
        promptId: prompt.id,
        expectedPromptUpdatedAt:
          (scenario.expectedPromptUpdatedAt as UtcDateTimeString) ??
          prompt.updatedAt,
        run,
      }),
    ).rejects.toMatchObject({ code });
    await expect(database.runs.count()).resolves.toBe(0);
  });
});
