import { afterEach, describe, expect, it } from 'vitest';

import type { Run, RunId, UtcDateTimeString } from '../domain';
import { sampleDataset } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import {
  listTrailsByPromptId,
  loadTrailListReadModel,
} from './trail-list-read-query';

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

  it('sums active Link counts across every Run of a Trail into linkCount', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: [...sampleDataset.links],
    });
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-link-count'),
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
    );
    await repository.saveLink({
      ...sampleDataset.links[0],
      id: 'link-list-extra' as (typeof sampleDataset.links)[0]['id'],
      runId: runId('run-list-link-count'),
    });

    const model = await loadTrailListReadModel(repository);

    expect(model.trails[0]).toMatchObject({
      linkCount: sampleDataset.links.length + 1,
    });
  });

  it('applies the limit option after sorting by updatedAt descending', async () => {
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
      id: 'trail-list-limit-second' as (typeof sampleDataset.trail)['id'],
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
    };
    const secondRun = cloneSampleRun({
      id: runId('run-list-limit-second'),
      trailId: secondTrail.id,
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
    });
    await repository.saveTrail(secondTrail);
    await repository.saveRun(secondRun);

    const model = await loadTrailListReadModel(repository, { limit: 1 });

    expect(model.trails.map((item) => item.trail.id)).toEqual([secondTrail.id]);
  });

  it('rejects a negative limit', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadTrailListReadModel(repository, { limit: -1 }),
    ).rejects.toThrow('limit must be a non-negative integer');
  });
});

describe('listTrailsByPromptId', () => {
  it('returns an empty list when no Run references the Prompt', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: [],
    });

    await expect(
      listTrailsByPromptId(
        repository,
        'prompt-list-missing' as (typeof sampleDataset.prompt)['id'],
      ),
    ).resolves.toEqual([]);
  });

  it('returns the Trail for a matching Run, found via the promptSnapshot.promptId index', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: [],
    });

    const items = await listTrailsByPromptId(
      repository,
      sampleDataset.prompt.id,
    );

    expect(items.map((item) => item.trail.id)).toEqual([
      sampleDataset.trail.id,
    ]);
  });

  it('deduplicates multiple Runs of the same Trail into a single entry', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await repository.insertTrailBundle({
      project: { ...sampleDataset.project },
      prompt: { ...sampleDataset.prompt },
      context: { ...sampleDataset.context },
      recipe: { ...sampleDataset.recipe },
      trail: { ...sampleDataset.trail },
      run: cloneSampleRun(),
      links: [],
    });
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-by-prompt-dup'),
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
    );

    const items = await listTrailsByPromptId(
      repository,
      sampleDataset.prompt.id,
    );

    expect(items).toHaveLength(1);
  });

  it('sorts matching Trails by updatedAt descending and applies the limit', async () => {
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
      id: 'trail-list-by-prompt-second' as (typeof sampleDataset.trail)['id'],
      updatedAt: utc('2026-07-13T00:00:00.000Z'),
    };
    await repository.saveTrail(secondTrail);
    await repository.saveRun(
      cloneSampleRun({
        id: runId('run-list-by-prompt-second'),
        trailId: secondTrail.id,
        updatedAt: utc('2026-07-13T00:00:00.000Z'),
      }),
    );

    const unlimited = await listTrailsByPromptId(
      repository,
      sampleDataset.prompt.id,
    );
    expect(unlimited.map((item) => item.trail.id)).toEqual([
      secondTrail.id,
      sampleDataset.trail.id,
    ]);

    const limited = await listTrailsByPromptId(
      repository,
      sampleDataset.prompt.id,
      1,
    );
    expect(limited.map((item) => item.trail.id)).toEqual([secondTrail.id]);
  });

  it('rejects a negative limit', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      listTrailsByPromptId(repository, sampleDataset.prompt.id, -1),
    ).rejects.toThrow('limit must be a non-negative integer');
  });
});
