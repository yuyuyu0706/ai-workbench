import type { Link, Prompt, Run, Trail } from '../../domain';
import {
  createDefaultProject,
  createDefaultWorkspace,
  DEFAULT_PROJECT_ID,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { linkId, promptId, runId, trailId, utc } from './helpers';

const createdAt = utc('2026-07-20T09:00:00.000Z');
const prompt: Prompt = {
  id: promptId('standard-prompt-direct-request'),
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
  title: 'Review the implementation plan',
  body: 'Review the implementation plan and identify its smallest safe change.',
  status: 'active',
  tags: ['standard'],
  variableValues: {},
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};
const trail: Trail = {
  id: trailId('standard-trail-direct-review'),
  projectId: DEFAULT_PROJECT_ID,
  title: prompt.title,
  kind: 'other',
  createdAt: utc('2026-07-20T09:10:00.000Z'),
  updatedAt: utc('2026-07-20T09:10:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const run: Run = {
  id: runId('standard-run-direct-review'),
  projectId: DEFAULT_PROJECT_ID,
  trailId: trail.id,
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
  output: null,
  messages: [],
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
    workspaces: [createDefaultWorkspace(createdAt)],
    projects: [createDefaultProject(createdAt)],
    prompts: [prompt],
    contexts: [],
    recipes: [],
    trails: [trail],
    runs: [run],
    links: [link],
  },
  expectedCounts: {
    workspaces: 1,
    projects: 1,
    prompts: 1,
    contexts: 0,
    recipes: 0,
    trails: 1,
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
