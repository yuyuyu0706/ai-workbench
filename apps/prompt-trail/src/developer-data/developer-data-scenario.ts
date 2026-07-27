import type {
  Context,
  Link,
  LinkId,
  Project,
  Prompt,
  Recipe,
  Run,
  RunId,
} from '../domain';
import type { DeveloperDataScenarioId } from './scenario-ids';

export type DeveloperScenarioDataset = {
  readonly projects: readonly Project[];
  readonly prompts: readonly Prompt[];
  readonly contexts: readonly Context[];
  readonly recipes: readonly Recipe[];
  readonly runs: readonly Run[];
  readonly links: readonly Link[];
};

/** Expected active record counts after loading a scenario. */
export type DeveloperScenarioExpectedCounts = {
  readonly projects: number;
  readonly prompts: number;
  readonly contexts: number;
  readonly recipes: number;
  readonly runs: number;
  readonly links: number;
};

export type DeveloperScenarioExpectations = {
  readonly dashboard: {
    readonly recentRunIds: readonly RunId[];
    readonly relatedLinkCounts: readonly {
      readonly runId: RunId;
      readonly count: number;
    }[];
  };
  readonly runDetail: {
    readonly urlFallbackLinkIds: readonly LinkId[];
  };
};

export type DeveloperDataScenario = {
  readonly id: DeveloperDataScenarioId;
  readonly label: string;
  readonly description: string;
  readonly dataset: DeveloperScenarioDataset;
  readonly expectedCounts: DeveloperScenarioExpectedCounts;
  readonly expectations: DeveloperScenarioExpectations;
};
