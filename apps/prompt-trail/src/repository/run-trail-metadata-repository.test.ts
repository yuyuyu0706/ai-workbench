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
  const prompt = {
    id: 'prompt-1',
    createdAt: oldTime,
    updatedAt: oldTime,
    deletedAt: null,
    scope: 'project',
    projectId: DEFAULT_PROJECT_ID,
    title: 'Prompt',
    body: 'Body',
    kind: 'codex-request',
    status: 'active',
    tags: [],
  } as Prompt;
  const run = {
    id: 'run-1',
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
  } as Run & { recipeId: null };
  await repository.createDirectRunBundle({ project, prompt, run });
  return { database, repository, run };
}

describe('updateRunTrailMetadata repository API', () => {
  it('updates only metadata and updatedAt', async () => {
    const { repository, run } = await prepare();
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
