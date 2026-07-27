export const DEVELOPER_DATA_SCENARIO_IDS = [
  'empty',
  'standard',
  'reuse-ready',
  'dense',
  'legacy-compatible',
] as const;

export type DeveloperDataScenarioId =
  (typeof DEVELOPER_DATA_SCENARIO_IDS)[number];
