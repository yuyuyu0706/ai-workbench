import type { Link, Prompt, Run, Trail, TrailStep } from '../../domain';
import {
  createDefaultProject,
  createDefaultWorkspace,
  DEFAULT_PROJECT_ID,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { linkId, promptId, runId, trailId, trailStepId, utc } from './helpers';

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
const trailStepReview: TrailStep = {
  id: trailStepId('standard-step-1-review'),
  createdAt: utc('2026-07-20T09:10:00.000Z'),
  updatedAt: utc('2026-07-20T09:10:00.000Z'),
  deletedAt: null,
  trailId: trail.id,
  order: 1,
  kind: 'prompt',
  title: prompt.title,
  promptId: prompt.id,
  note: null,
};
const trailStepApproval: TrailStep = {
  id: trailStepId('standard-step-2-approval'),
  createdAt: utc('2026-07-20T09:11:00.000Z'),
  updatedAt: utc('2026-07-20T09:11:00.000Z'),
  deletedAt: null,
  trailId: trail.id,
  order: 2,
  kind: 'manual',
  title: 'Get reviewer approval',
  promptId: null,
  note: 'Wait for a human reviewer to approve the plan before merging.',
};
const trailStepFollowUp: TrailStep = {
  id: trailStepId('standard-step-3-follow-up-prompt'),
  createdAt: utc('2026-07-20T09:12:00.000Z'),
  updatedAt: utc('2026-07-20T09:12:00.000Z'),
  deletedAt: null,
  trailId: trail.id,
  order: 3,
  kind: 'prompt',
  title: 'Draft the follow-up summary',
  promptId: prompt.id,
  note: null,
};
const trailSteps: readonly TrailStep[] = [
  trailStepReview,
  trailStepApproval,
  trailStepFollowUp,
];
const run: Run = {
  id: runId('standard-run-direct-review'),
  projectId: DEFAULT_PROJECT_ID,
  trailId: trail.id,
  trailStepId: trailStepReview.id,
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
    trailSteps,
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
    trailSteps: 3,
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
