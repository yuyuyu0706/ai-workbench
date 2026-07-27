import type { Link, Prompt, Run } from '../../domain';
import { createDefaultProject, DEFAULT_PROJECT_ID } from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { linkId, promptId, runId, utc } from './helpers';

const createdAt = utc('2026-07-20T09:00:00.000Z');
const prompt: Prompt = {
  id: promptId('standard-prompt-direct-request'),
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
  title: 'Review the implementation plan',
  body: 'Review the implementation plan and identify its smallest safe change.',
  kind: 'design-review',
  status: 'active',
  tags: ['standard'],
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};
const run: Run = {
  id: runId('standard-run-direct-review'),
  projectId: DEFAULT_PROJECT_ID,
  recipeId: null,
  promptSnapshot: {
    promptId: prompt.id,
    title: prompt.title,
    body: prompt.body,
  },
  contextSnapshots: [],
  inputValues: {},
  finalPrompt: prompt.body,
  status: 'prepared',
  evaluation: null,
  improvementNote: null,
  createdAt: utc('2026-07-20T09:10:00.000Z'),
  updatedAt: utc('2026-07-20T09:10:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const link: Link = {
  id: linkId('standard-link-review-pr'),
  runId: run.id,
  url: 'https://github.com/yuyuyu0706/ai-workbench/pull/179',
  title: 'Implementation review pull request',
  type: 'pull-request',
  role: null,
  summary: null,
  externalId: '179',
  createdAt: utc('2026-07-20T09:15:00.000Z'),
  updatedAt: utc('2026-07-20T09:15:00.000Z'),
  deletedAt: null,
};

export const standardScenario: DeveloperDataScenario = {
  id: 'standard',
  label: 'Standard direct trail',
  description: 'The smallest current Direct Run trail in the default project.',
  dataset: {
    projects: [createDefaultProject(createdAt)],
    prompts: [prompt],
    contexts: [],
    recipes: [],
    runs: [run],
    links: [link],
  },
  expectedCounts: {
    projects: 1,
    prompts: 1,
    contexts: 0,
    recipes: 0,
    runs: 1,
    links: 1,
  },
  expectations: {
    dashboard: {
      recentRunIds: [run.id],
      relatedLinkCounts: [{ runId: run.id, count: 1 }],
    },
    runDetail: { urlFallbackLinkIds: [] },
  },
};
