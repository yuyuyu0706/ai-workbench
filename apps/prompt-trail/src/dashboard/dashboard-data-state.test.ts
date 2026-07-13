import { afterEach, describe, expect, it } from 'vitest';

import { sampleDataset, seedSampleData } from '../sample-data';
import { createDatabaseTestScope } from '../test/database-test-utils';
import { PromptTrailRepository } from '../repository';

import { loadDashboardDataState } from './dashboard-data-state';

const databaseScope = createDatabaseTestScope('dashboard-data-state');

afterEach(async () => {
  await databaseScope.cleanup();
});

describe('loadDashboardDataState', () => {
  it('classifies a read model with recent runs as data and preserves the model', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedSampleData(repository);

    await expect(
      loadDashboardDataState(repository, { recentRunLimit: 10 }),
    ).resolves.toEqual({
      status: 'data',
      data: {
        recentRuns: [
          {
            run: sampleDataset.run,
            project: sampleDataset.project,
            recipe: sampleDataset.recipe,
            links: sampleDataset.links,
          },
        ],
      },
    });
  });

  it('classifies an empty read model as empty without treating it as failure', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    await expect(
      loadDashboardDataState(repository, { recentRunLimit: 10 }),
    ).resolves.toEqual({ status: 'empty' });
  });

  it('converts a missing recipe query error into failure and preserves the original error', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);
    await seedSampleData(repository);
    await database.recipes.delete(sampleDataset.recipe.id);

    const state = await loadDashboardDataState(repository, {
      recentRunLimit: 1,
    });

    expect(state.status).toBe('failure');
    if (state.status !== 'failure') {
      throw new Error('Expected dashboard data state to be failure');
    }
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error).toHaveProperty(
      'message',
      `Recipe not found for dashboard run: ${sampleDataset.run.recipeId}`,
    );
  });

  it('converts recent run limit validation errors into failure and preserves the original error', async () => {
    const database = databaseScope.createDatabase();
    const repository = new PromptTrailRepository(database);

    const state = await loadDashboardDataState(repository, {
      recentRunLimit: -1,
    });

    expect(state.status).toBe('failure');
    if (state.status !== 'failure') {
      throw new Error('Expected dashboard data state to be failure');
    }
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error).toHaveProperty(
      'message',
      'recentRunLimit must be a non-negative integer',
    );
  });
});
