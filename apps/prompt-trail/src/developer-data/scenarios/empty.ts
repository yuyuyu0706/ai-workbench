import type { DeveloperDataScenario } from '../developer-data-scenario';

export const emptyScenario: DeveloperDataScenario = {
  id: 'empty',
  label: 'Empty database',
  description: 'Represents a fresh database with no PromptTrail records.',
  dataset: {
    projects: [],
    prompts: [],
    contexts: [],
    recipes: [],
    runs: [],
    links: [],
  },
  expectedCounts: {
    projects: 0,
    prompts: 0,
    contexts: 0,
    recipes: 0,
    runs: 0,
    links: 0,
  },
  expectations: {
    dashboard: { recentRunIds: [], relatedLinkCounts: [] },
    runDetail: { urlFallbackLinkIds: [] },
  },
};
