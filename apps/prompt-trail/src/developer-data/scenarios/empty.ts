import type { DeveloperDataScenario } from '../developer-data-scenario';

export const emptyScenario: DeveloperDataScenario = {
  id: 'empty',
  label: 'Empty database',
  description: 'Represents a fresh database with no PromptTrail records.',
  dataset: {
    workspaces: [],
    projects: [],
    prompts: [],
    contexts: [],
    recipes: [],
    trails: [],
    runs: [],
    links: [],
  },
  expectedCounts: {
    workspaces: 0,
    projects: 0,
    prompts: 0,
    contexts: 0,
    recipes: 0,
    trails: 0,
    runs: 0,
    links: 0,
  },
  expectations: {
    dashboard: { recentRunIds: [], relatedLinkCounts: [] },
    runDetail: { urlFallbackLinkIds: [] },
  },
};
