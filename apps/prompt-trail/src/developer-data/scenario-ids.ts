import type {
  ContextId,
  LinkId,
  ProjectId,
  PromptId,
  RecipeId,
  RunId,
  UtcDateTimeString,
} from '../domain';

export const DEVELOPER_DATA_SCENARIO_IDS = [
  'empty',
  'standard',
  'reuse-ready',
  'dense',
  'legacy-compatible',
] as const;

export type DeveloperDataScenarioId =
  (typeof DEVELOPER_DATA_SCENARIO_IDS)[number];

export const scenarioValue = {
  projectId: (value: string) => value as ProjectId,
  promptId: (value: string) => value as PromptId,
  contextId: (value: string) => value as ContextId,
  recipeId: (value: string) => value as RecipeId,
  runId: (value: string) => value as RunId,
  linkId: (value: string) => value as LinkId,
  utc: (value: string) => value as UtcDateTimeString,
} as const;
