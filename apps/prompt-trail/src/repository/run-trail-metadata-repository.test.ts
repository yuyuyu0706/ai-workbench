import { afterEach, describe, expect, it } from 'vitest';
import type { Prompt, Run, UtcDateTimeString } from '../domain';
import { createDefaultProject, DEFAULT_PROJECT_ID } from '../domain';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from './index';

const scope = createDatabaseTestScope('run-trail-metadata');
const oldTime = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;
const newTime = '2026-08-02T00:00:00.000Z' as UtcDateTimeString;
afterEach(() => scope.cleanup());

async function prepare() {
  const database = scope.createDatabase();
  const repository = new PromptTrailRepository(database);
  const project = createDefaultProject(oldTime);
  const promptId = 'prompt-1' as Prompt['id'];
  const runId = 'run-1' as Run['id'];
  const prompt: Prompt = {
    id: promptId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    scope: 'project',
    projectId: DEFAULT_PROJECT_ID,
    title: 'Prompt',
    body: 'Body',
    status: 'active',
    tags: [],
    variableValues: {},
  };
  const run: Run & { readonly recipeId: null } = {
    id: runId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    trailTitle: 'Old',
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
  };
  await repository.createDirectRunBundle({ project, prompt, run });
  return { database, repository, run };
}

describe('updateRunTrailMetadata repository API', () => {
  it('rejects a missing Run', async () => {
    const database = scope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await expect(
      repository.updateRunTrailMetadata({
        runId: 'missing' as Run['id'],
        expectedUpdatedAt: oldTime,
        trailTitle: 'New',
        trailKind: 'other',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
  });

  it('rejects a deleted Run without changing it', async () => {
    const { database, repository, run } = await prepare();
    const deleted = { ...run, deletedAt: oldTime };
    await database.runs.put(deleted);
    await expect(
      repository.updateRunTrailMetadata({
        runId: run.id,
        expectedUpdatedAt: oldTime,
        trailTitle: 'New',
        trailKind: 'other',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'reference-unavailable' });
    await expect(repository.getRun(run.id)).resolves.toEqual(deleted);
  });

  it('updates only metadata and updatedAt', async () => {
    const { database, repository, run } = await prepare();
    const storeCounts = await Promise.all([
      database.projects.count(),
      database.prompts.count(),
      database.contexts.count(),
      database.recipes.count(),
      database.links.count(),
    ]);
    const updated = await repository.updateRunTrailMetadata({
      runId: run.id,
      expectedUpdatedAt: oldTime,
      trailTitle: 'New',
      trailKind: 'research',
      updatedAt: newTime,
    });
    expect(updated).toEqual({
      ...run,
      trailTitle: 'New',
      trailKind: 'research',
      updatedAt: newTime,
    });
    await expect(
      Promise.all([
        database.projects.count(),
        database.prompts.count(),
        database.contexts.count(),
        database.recipes.count(),
        database.links.count(),
      ]),
    ).resolves.toEqual(storeCounts);
  });

  it('rejects stale writes without changing the stored Run', async () => {
    const { repository, run } = await prepare();
    await expect(
      repository.updateRunTrailMetadata({
        runId: run.id,
        expectedUpdatedAt: newTime,
        trailTitle: 'Lost',
        trailKind: 'review',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'stale-write' });
    await expect(repository.getRun(run.id)).resolves.toEqual(run);
  });

  it('allows only one of two updates with the same expected timestamp', async () => {
    const { repository, run } = await prepare();
    const values = await Promise.allSettled(
      ['A', 'B'].map((trailTitle) =>
        repository.updateRunTrailMetadata({
          runId: run.id,
          expectedUpdatedAt: oldTime,
          trailTitle,
          trailKind: 'other',
          updatedAt: newTime,
        }),
      ),
    );
    expect(values.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(values.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
  });
});
