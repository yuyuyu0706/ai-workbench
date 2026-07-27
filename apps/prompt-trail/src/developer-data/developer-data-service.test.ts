import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptTrailDatabase } from '../db';
import {
  createDatabaseTestScope,
  type DatabaseTestScope,
} from '../test/database-test-utils';
import {
  DEVELOPER_DATA_SCENARIO_IDS,
  DeveloperDataService,
  DeveloperScenarioCountMismatchError,
  getDeveloperDataScenario,
} from './index';

const emptyCounts = {
  projects: 0,
  prompts: 0,
  contexts: 0,
  recipes: 0,
  runs: 0,
  links: 0,
};

describe('DeveloperDataService', () => {
  let scope: DatabaseTestScope;
  let database: PromptTrailDatabase;
  let service: DeveloperDataService;

  beforeEach(() => {
    scope = createDatabaseTestScope('developer-data-service');
    database = scope.createDatabase();
    service = new DeveloperDataService(database);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await scope.cleanup();
  });

  it('counts every store in a fresh database', async () => {
    await expect(service.getRecordCounts()).resolves.toEqual(emptyCounts);
  });

  it.each(DEVELOPER_DATA_SCENARIO_IDS)(
    'loads the %s catalog dataset into an empty database',
    async (scenarioId) => {
      const scenario = getDeveloperDataScenario(scenarioId);

      await expect(service.loadScenario(scenarioId)).resolves.toEqual({
        status: 'loaded',
        scenarioId,
        counts: scenario.expectedCounts,
      });
      await expect(readAllStores(database)).resolves.toEqual(scenario.dataset);
    },
  );

  it.each(['standard', 'empty'] as const)(
    'rejects loading %s into a non-empty database without changing data',
    async (scenarioId) => {
      await service.loadScenario('dense');
      const before = await readAllStores(database);
      const counts = getDeveloperDataScenario('dense').expectedCounts;

      await expect(service.loadScenario(scenarioId)).resolves.toEqual({
        status: 'database-not-empty',
        counts,
      });
      await expect(readAllStores(database)).resolves.toEqual(before);
    },
  );

  it('clears all records including soft-deleted records', async () => {
    await service.loadScenario('dense');
    expect(getDeveloperDataScenario('dense').expectedCounts.links).toBe(4);

    await expect(service.resetDatabase()).resolves.toEqual({
      status: 'reset',
      counts: emptyCounts,
    });
    await expect(service.getRecordCounts()).resolves.toEqual(emptyCounts);
  });

  it('replaces existing data and can repeatedly load same and different scenarios', async () => {
    await service.loadScenario('standard');

    for (const scenarioId of ['dense', 'dense', 'reuse-ready'] as const) {
      const scenario = getDeveloperDataScenario(scenarioId);
      await expect(service.resetAndLoadScenario(scenarioId)).resolves.toEqual({
        status: 'reset-and-loaded',
        scenarioId,
        counts: scenario.expectedCounts,
      });
      await expect(readAllStores(database)).resolves.toEqual(scenario.dataset);
    }
  });

  it('treats reset and load of empty as a supported full reset', async () => {
    await service.loadScenario('dense');

    await expect(service.resetAndLoadScenario('empty')).resolves.toEqual({
      status: 'reset-and-loaded',
      scenarioId: 'empty',
      counts: emptyCounts,
    });
  });

  it('rolls back a partially inserted scenario when bulkAdd fails', async () => {
    vi.spyOn(database.runs, 'bulkAdd').mockRejectedValueOnce(
      new Error('injected bulkAdd failure'),
    );

    await expect(service.loadScenario('dense')).rejects.toThrow(
      'injected bulkAdd failure',
    );
    await expect(service.getRecordCounts()).resolves.toEqual(emptyCounts);
  });

  it('rolls back clears when reset fails', async () => {
    await service.loadScenario('dense');
    const before = await readAllStores(database);
    vi.spyOn(database.contexts, 'clear').mockRejectedValueOnce(
      new Error('injected clear failure'),
    );

    await expect(service.resetDatabase()).rejects.toThrow(
      'injected clear failure',
    );
    await expect(readAllStores(database)).resolves.toEqual(before);
  });

  it('rolls back reset and load when insertion fails after clearing', async () => {
    await service.loadScenario('standard');
    const before = await readAllStores(database);
    vi.spyOn(database.runs, 'bulkAdd').mockRejectedValueOnce(
      new Error('injected replacement failure'),
    );

    await expect(service.resetAndLoadScenario('dense')).rejects.toThrow(
      'injected replacement failure',
    );
    await expect(readAllStores(database)).resolves.toEqual(before);
  });

  it('rejects a post-load count mismatch and rolls the transaction back', async () => {
    await service.loadScenario('standard');
    const before = await readAllStores(database);
    const countSpy = vi
      .spyOn(database.links, 'count')
      .mockResolvedValueOnce(99);

    await expect(service.resetAndLoadScenario('dense')).rejects.toBeInstanceOf(
      DeveloperScenarioCountMismatchError,
    );
    countSpy.mockRestore();
    await expect(readAllStores(database)).resolves.toEqual(before);
  });
});

async function readAllStores(database: PromptTrailDatabase) {
  return database.transaction('r', database.tables, async () => ({
    projects: await database.projects.toArray(),
    prompts: await database.prompts.toArray(),
    contexts: await database.contexts.toArray(),
    recipes: await database.recipes.toArray(),
    runs: await database.runs.toArray(),
    links: await database.links.toArray(),
  }));
}
