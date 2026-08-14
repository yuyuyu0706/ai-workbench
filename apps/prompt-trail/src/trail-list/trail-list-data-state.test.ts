import { afterEach, describe, expect, it } from 'vitest';

import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import { loadTrailListDataState } from './trail-list-data-state';

const databaseScope = createDatabaseTestScope('trail-list-data-state');

afterEach(async () => {
  await databaseScope.cleanup();
});

describe('loadTrailListDataState', () => {
  it('classifies a read model with Trails as data and preserves the model', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedSampleData(repository);

    await expect(
      loadTrailListDataState(repository, { limit: 10 }),
    ).resolves.toEqual({
      status: 'data',
      data: {
        trails: [
          {
            trail: sampleDataset.trail,
            title: sampleDataset.trail.title,
            kind: sampleDataset.trail.kind,
            status: sampleDataset.run.status,
            updatedAt: sampleDataset.trail.updatedAt,
            runCount: 1,
            linkCount: sampleDataset.links.length,
          },
        ],
      },
    });
  });

  it('classifies an empty read model as empty without treating it as failure', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadTrailListDataState(repository, { limit: 10 }),
    ).resolves.toEqual({ status: 'empty' });
  });

  it('classifies an empty read model as empty when no options are provided', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(loadTrailListDataState(repository)).resolves.toEqual({
      status: 'empty',
    });
  });

  it('converts a repository read error into failure and preserves the original error', async () => {
    const repository = {
      listActiveProjects: async () => {
        throw new Error('raw database stack detail');
      },
    } as unknown as PromptTrailRepository;

    const state = await loadTrailListDataState(repository, { limit: 10 });

    expect(state.status).toBe('failure');
    if (state.status !== 'failure') {
      throw new Error('Expected trail list data state to be failure');
    }
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error).toHaveProperty('message', 'raw database stack detail');
  });

  it('converts limit validation errors into failure and preserves the original error', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    const state = await loadTrailListDataState(repository, { limit: -1 });

    expect(state.status).toBe('failure');
    if (state.status !== 'failure') {
      throw new Error('Expected trail list data state to be failure');
    }
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error).toHaveProperty(
      'message',
      'limit must be a non-negative integer',
    );
  });
});
