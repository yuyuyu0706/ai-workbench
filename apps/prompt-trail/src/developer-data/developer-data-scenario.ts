import type {
  Context,
  Link,
  LinkId,
  Project,
  Prompt,
  Recipe,
  Run,
  RunId,
  Trail,
  Workspace,
} from '../domain';
import type { DeveloperDataScenarioId } from './scenario-ids';

export type DeveloperScenarioDataset = {
  readonly workspaces: readonly Workspace[];
  readonly projects: readonly Project[];
  readonly prompts: readonly Prompt[];
  readonly contexts: readonly Context[];
  readonly recipes: readonly Recipe[];
  readonly trails: readonly Trail[];
  readonly runs: readonly Run[];
  readonly links: readonly Link[];
};

/** Total record counts persisted when loading a scenario. */
export type DeveloperScenarioExpectedCounts = {
  readonly workspaces: number;
  readonly projects: number;
  readonly prompts: number;
  readonly contexts: number;
  readonly recipes: number;
  readonly trails: number;
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
