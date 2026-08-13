import type { Table } from 'dexie';

import {
  PROMPT_TRAIL_STORE_NAMES,
  type PromptTrailDatabase,
  type PromptTrailStoreName,
} from '../db';
import type { DeveloperDataScenarioId } from './scenario-ids';
import { getDeveloperDataScenario } from './scenario-catalog';
import type {
  DeveloperScenarioDataset,
  DeveloperScenarioExpectedCounts,
} from './developer-data-scenario';

export type DeveloperRecordCounts = Readonly<
  Record<PromptTrailStoreName, number>
>;

export type LoadDeveloperScenarioResult =
  | {
      readonly status: 'loaded';
      readonly scenarioId: DeveloperDataScenarioId;
      readonly counts: DeveloperRecordCounts;
    }
  | {
      readonly status: 'database-not-empty';
      readonly counts: DeveloperRecordCounts;
    };

export type ResetDeveloperDatabaseResult = {
  readonly status: 'reset';
  readonly counts: DeveloperRecordCounts;
};

export type ResetAndLoadDeveloperScenarioResult = {
  readonly status: 'reset-and-loaded';
  readonly scenarioId: DeveloperDataScenarioId;
  readonly counts: DeveloperRecordCounts;
};

export class DeveloperScenarioCountMismatchError extends Error {
  constructor(
    readonly actual: DeveloperRecordCounts,
    readonly expected: DeveloperScenarioExpectedCounts,
  ) {
    super('Loaded developer scenario record counts do not match expectations.');
    this.name = 'DeveloperScenarioCountMismatchError';
  }
}

export class DeveloperDataService {
  constructor(private readonly database: PromptTrailDatabase) {}

  getRecordCounts(): Promise<DeveloperRecordCounts> {
    return this.database.transaction('r', this.database.tables, () =>
      this.countAllStores(),
    );
  }

  loadScenario(
    scenarioId: DeveloperDataScenarioId,
  ): Promise<LoadDeveloperScenarioResult> {
    const scenario = getDeveloperDataScenario(scenarioId);

    return this.database.transaction('rw', this.database.tables, async () => {
      const currentCounts = await this.countAllStores();
      if (PROMPT_TRAIL_STORE_NAMES.some((name) => currentCounts[name] > 0)) {
        return { status: 'database-not-empty', counts: currentCounts };
      }

      await this.insertScenarioDataset(scenario.dataset);
      const counts = await this.countAllStores();
      this.assertExpectedCounts(counts, scenario.expectedCounts);
      return { status: 'loaded', scenarioId, counts };
    });
  }

  resetDatabase(): Promise<ResetDeveloperDatabaseResult> {
    return this.database.transaction('rw', this.database.tables, async () => {
      await this.clearAllStores();
      const counts = await this.countAllStores();
      this.assertExpectedCounts(counts, EMPTY_COUNTS);
      return { status: 'reset', counts };
    });
  }

  resetAndLoadScenario(
    scenarioId: DeveloperDataScenarioId,
  ): Promise<ResetAndLoadDeveloperScenarioResult> {
    const scenario = getDeveloperDataScenario(scenarioId);

    return this.database.transaction('rw', this.database.tables, async () => {
      await this.clearAllStores();
      await this.insertScenarioDataset(scenario.dataset);
      const counts = await this.countAllStores();
      this.assertExpectedCounts(counts, scenario.expectedCounts);
      return { status: 'reset-and-loaded', scenarioId, counts };
    });
  }

  private async countAllStores(): Promise<DeveloperRecordCounts> {
    const [
      workspaces,
      projects,
      prompts,
      contexts,
      recipes,
      trails,
      runs,
      links,
    ] = await Promise.all([
      this.database.workspaces.count(),
      this.database.projects.count(),
      this.database.prompts.count(),
      this.database.contexts.count(),
      this.database.recipes.count(),
      this.database.trails.count(),
      this.database.runs.count(),
      this.database.links.count(),
    ]);
    return {
      workspaces,
      projects,
      prompts,
      contexts,
      recipes,
      trails,
      runs,
      links,
    };
  }

  private async clearAllStores(): Promise<void> {
    await this.database.links.clear();
    await this.database.runs.clear();
    await this.database.trails.clear();
    await this.database.recipes.clear();
    await this.database.contexts.clear();
    await this.database.prompts.clear();
    await this.database.projects.clear();
    await this.database.workspaces.clear();
  }

  private async insertScenarioDataset(
    dataset: DeveloperScenarioDataset,
  ): Promise<void> {
    await bulkAddWhenPopulated(this.database.workspaces, dataset.workspaces);
    await bulkAddWhenPopulated(this.database.projects, dataset.projects);
    await bulkAddWhenPopulated(this.database.prompts, dataset.prompts);
    await bulkAddWhenPopulated(this.database.contexts, dataset.contexts);
    await bulkAddWhenPopulated(this.database.recipes, dataset.recipes);
    await bulkAddWhenPopulated(this.database.trails, dataset.trails);
    await bulkAddWhenPopulated(this.database.runs, dataset.runs);
    await bulkAddWhenPopulated(this.database.links, dataset.links);
  }

  private assertExpectedCounts(
    actual: DeveloperRecordCounts,
    expected: DeveloperScenarioExpectedCounts,
  ): void {
    if (
      PROMPT_TRAIL_STORE_NAMES.some((name) => actual[name] !== expected[name])
    )
      throw new DeveloperScenarioCountMismatchError(actual, expected);
  }
}

const EMPTY_COUNTS: DeveloperScenarioExpectedCounts = {
  workspaces: 0,
  projects: 0,
  prompts: 0,
  contexts: 0,
  recipes: 0,
  trails: 0,
  runs: 0,
  links: 0,
};

async function bulkAddWhenPopulated<T, TKey>(
  table: Table<T, TKey>,
  records: readonly T[],
): Promise<void> {
  if (records.length > 0) await table.bulkAdd([...records]);
}
