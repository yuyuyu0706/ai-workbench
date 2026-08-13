import type { Link, Project, Prompt, Run, Trail, Workspace } from '../../domain';
import { DEFAULT_WORKSPACE_ID, createDefaultWorkspace } from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { linkId, projectId, promptId, runId, trailId, utc } from './helpers';

const time = utc('2026-07-21T10:00:00.000Z');
const workspace: Workspace = createDefaultWorkspace(time);
const project: Project = {
  id: projectId('reuse-ready-project-source'),
  workspaceId: DEFAULT_WORKSPACE_ID,
  name: 'Reuse source project',
  description: null,
  tags: ['reuse-ready'],
  repositoryUrl: null,
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
  archivedAt: null,
};
const prompt: Prompt = {
  id: promptId('reuse-ready-prompt-source'),
  scope: 'project',
  projectId: project.id,
  title: 'Reusable incident review',
  body: 'Review the incident evidence and propose follow-up actions.',
  status: 'active',
  tags: ['reusable'],
  variableValues: {},
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
};
const trail: Trail = {
  id: trailId('reuse-ready-trail-completed-source'),
  projectId: project.id,
  title: prompt.title,
  kind: 'other',
  createdAt: utc('2026-07-21T10:10:00.000Z'),
  updatedAt: utc('2026-07-21T10:20:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const run: Run = {
  id: runId('reuse-ready-run-completed-source'),
  projectId: project.id,
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
  status: 'done',
  evaluation: 'good',
  improvementNote: null,
  createdAt: utc('2026-07-21T10:10:00.000Z'),
  updatedAt: utc('2026-07-21T10:20:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const link: Link = {
  id: linkId('reuse-ready-link-completed-result'),
  runId: run.id,
  url: 'https://example.com/incidents/42',
  title: 'Completed incident report',
  type: 'document',
  role: 'result',
  summary: null,
  externalId: '42',
  createdAt: run.updatedAt,
  updatedAt: run.updatedAt,
  deletedAt: null,
};

export const reuseReadyScenario: DeveloperDataScenario = {
  id: 'reuse-ready',
  label: 'Reuse-ready source',
  description:
    'A completed named trail that is available as a future reuse source.',
  dataset: {
    workspaces: [workspace],
    projects: [project],
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
