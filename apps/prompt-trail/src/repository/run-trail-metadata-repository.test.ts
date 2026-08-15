import { afterEach, describe, expect, it } from 'vitest';
import type { Prompt, Run, Trail, UtcDateTimeString } from '../domain';
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
  const trailId = 'trail-1' as Trail['id'];
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
  const trail: Trail = {
    id: trailId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    title: 'Old',
    kind: 'other',
  };
  const run: Run & { readonly recipeId: null } = {
    id: runId,
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    archivedAt: null,
    projectId: DEFAULT_PROJECT_ID,
    trailId,
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
    output: null,
  };
  await repository.createDirectRunBundle({ project, prompt, trail, run });
  return { database, repository, run, trail };
}

describe('updateTrailMetadata repository API', () => {
  it('rejects a missing Trail', async () => {
    const database = scope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await expect(
      repository.updateTrailMetadata({
        trailId: 'missing' as Trail['id'],
        expectedUpdatedAt: oldTime,
        title: 'New',
        kind: 'other',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'reference-not-found' });
  });

  it('rejects a deleted Trail without changing it', async () => {
    const { database, repository, trail } = await prepare();
    const deleted = { ...trail, deletedAt: oldTime };
    await database.trails.put(deleted);
    await expect(
      repository.updateTrailMetadata({
        trailId: trail.id,
        expectedUpdatedAt: oldTime,
        title: 'New',
        kind: 'other',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'reference-unavailable' });
    await expect(repository.getTrail(trail.id)).resolves.toEqual(deleted);
  });

  it('updates only metadata and updatedAt', async () => {
    const { database, repository, trail } = await prepare();
    const storeCounts = await Promise.all([
      database.projects.count(),
      database.prompts.count(),
      database.contexts.count(),
      database.recipes.count(),
      database.runs.count(),
      database.links.count(),
    ]);
    const updated = await repository.updateTrailMetadata({
      trailId: trail.id,
      expectedUpdatedAt: oldTime,
      title: 'New',
      kind: 'research',
      updatedAt: newTime,
    });
    expect(updated).toEqual({
      ...trail,
      title: 'New',
      kind: 'research',
      updatedAt: newTime,
    });
    await expect(
      Promise.all([
        database.projects.count(),
        database.prompts.count(),
        database.contexts.count(),
        database.recipes.count(),
        database.runs.count(),
        database.links.count(),
      ]),
    ).resolves.toEqual(storeCounts);
  });

  it('rejects stale writes without changing the stored Trail', async () => {
    const { repository, trail } = await prepare();
    await expect(
      repository.updateTrailMetadata({
        trailId: trail.id,
        expectedUpdatedAt: newTime,
        title: 'Lost',
        kind: 'review',
        updatedAt: newTime,
      }),
    ).rejects.toMatchObject({ code: 'stale-write' });
    await expect(repository.getTrail(trail.id)).resolves.toEqual(trail);
  });

  it('allows only one of two updates with the same expected timestamp', async () => {
    const { repository, trail } = await prepare();
    const values = await Promise.allSettled(
      ['A', 'B'].map((title) =>
        repository.updateTrailMetadata({
          trailId: trail.id,
          expectedUpdatedAt: oldTime,
          title,
          kind: 'other',
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
