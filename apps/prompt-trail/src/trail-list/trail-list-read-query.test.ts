import { afterEach, describe, expect, it } from 'vitest';

import type { Run, RunId, UtcDateTimeString } from '../domain';
import { sampleDataset } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import { loadTrailListReadModel } from './trail-list-read-query';

const databaseScope = createDatabaseTestScope('trail-list-read-query');

afterEach(async () => {
  await databaseScope.cleanup();
});

function runId(value: string): RunId {
  return value as RunId;
}

function utc(value: string): UtcDateTimeString {
  return value as UtcDateTimeString;
}

function cloneSampleRun(overrides: Partial<Run> = {}): Run {
  return { ...sampleDataset.run, ...overrides };
}

describe('loadTrailListReadModel', () => {
  it('returns an empty read model for an empty database', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(loadTrailListReadModel(repository)).resolves.toEqual({
      trails: [],
    });
  });

  it('aggregates status as the most-advanced Run status and counts every active Run', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun({ status: 'prepared' }),
      links: [],
    });
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-in-progress'),
        status: 'in-progress',
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
    );
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-draft'),
        status: 'draft',
        updatedAt: utc('2026-07-13T01:00:00.000Z'),
      }),
    );

    const model = await loadTrailListReadModel(repository);

    expect(model.trails).toHaveLength(1);
    expect(model.trails[0]).toMatchObject({
      trail: sampleDataset.trail,
      title: sampleDataset.trail.title,
      kind: sampleDataset.trail.kind,
      status: 'in-progress',
      runCount: 3,
    });
  });

  it('excludes deleted Runs from the run count and status aggregation', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun({ status: 'draft' }),
      links: [],
    });
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-deleted-done'),
        status: 'done',
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
        deletedAt: utc('2026-07-13T00:10:00.000Z'),
      }),
    );

    const model = await loadTrailListReadModel(repository);

    expect(model.trails[0]).toMatchObject({ status: 'draft', runCount: 1 });
  });

  it('sorts Trails by updatedAt descending, tie-broken by id ascending', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: {
        ...sampleDataset.trail,
        updatedAt: utc('2026-07-12T00:00:00.000Z'),
      },
      run: cloneSampleRun(),
      links: [],
    });
    const secondTrail = {
      ...sampleDataset.trail,
      id: 'trail-list-second' as (typeof sampleDataset.trail)['id'],
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
    };
    const secondRun = cloneSampleRun({
      id: runId('run-list-second'),
      trailId: secondTrail.id,
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
    });
    await repository.saveTrail(secondTrail);
    await repository.saveRun(secondRun);

    const model = await loadTrailListReadModel(repository);

    expect(model.trails.map((item) => item.trail.id)).toEqual([
      secondTrail.id,
      sampleDataset.trail.id,
    ]);
  });
});
