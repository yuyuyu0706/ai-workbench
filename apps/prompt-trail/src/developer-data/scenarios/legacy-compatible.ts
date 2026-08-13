import type {
  Context,
  Link,
  Project,
  Prompt,
  Recipe,
  Run,
  Trail,
  Workspace,
} from '../../domain';
import { DEFAULT_WORKSPACE_ID, createDefaultWorkspace } from '../../domain';
import type { ContextId } from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import {
  linkId,
  projectId,
  promptId,
  recipeId,
  runId,
  trailId,
  utc,
} from './helpers';

const time = utc('2026-07-23T11:00:00.000Z');
const workspace: Workspace = createDefaultWorkspace(time);
const project: Project = {
  id: projectId('legacy-compatible-project'),
  workspaceId: DEFAULT_WORKSPACE_ID,
  name: 'Legacy compatibility',
  description: null,
  tags: ['legacy'],
  repositoryUrl: null,
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
  archivedAt: null,
};
const prompt: Prompt = {
  id: promptId('legacy-compatible-prompt'),
  scope: 'project',
  projectId: project.id,
  title: 'Legacy recipe prompt',
  body: 'Summarize the legacy input.',
  status: 'active',
  tags: [],
  variableValues: {},
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
};
const context: Context = {
  id: 'legacy-compatible-context' as ContextId,
  scope: 'project',
  projectId: project.id,
  title: 'Legacy context',
  body: 'Preserve stored compatibility values.',
  kind: 'other',
  status: 'enabled',
  tags: [],
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
};
const recipe: Recipe = {
  id: recipeId('legacy-compatible-recipe'),
  projectId: project.id,
  title: 'Stored legacy recipe',
  description: null,
  promptId: prompt.id,
  contextIds: [context.id],
  createdAt: time,
  updatedAt: time,
  deletedAt: null,
};
const trail: Trail = {
  id: trailId('legacy-compatible-trail-recipe'),
  projectId: project.id,
  title: prompt.title,
  kind: 'other',
  createdAt: utc('2026-07-23T11:10:00.000Z'),
  updatedAt: utc('2026-07-23T11:20:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const run: Run = {
  id: runId('legacy-compatible-run-recipe'),
  projectId: project.id,
  trailId: trail.id,
  recipeId: recipe.id,
  promptSnapshot: {
    promptId: prompt.id,
    title: prompt.title,
    body: prompt.body,
  },
  contextSnapshots: [
    { contextId: context.id, title: context.title, body: context.body },
  ],
  inputValues: { legacy: true },
  finalPrompt: `${context.body}\n\n${prompt.body}`,
  status: 'done',
  evaluation: null,
  improvementNote: null,
  createdAt: utc('2026-07-23T11:10:00.000Z'),
  updatedAt: utc('2026-07-23T11:20:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const link: Link = {
  id: linkId('legacy-compatible-link-unnamed-external'),
  runId: run.id,
  url: 'https://legacy.example.com/results/unnamed',
  title: null,
  type: 'external',
  role: 'source',
  summary: null,
  externalId: null,
  createdAt: run.updatedAt,
  updatedAt: run.updatedAt,
  deletedAt: null,
};

export const legacyCompatibleScenario: DeveloperDataScenario = {
  id: 'legacy-compatible',
  label: 'Legacy-compatible recipe trail',
  description:
    'A Recipe Run retaining an unnamed external Link and stored legacy role.',
  dataset: {
    workspaces: [workspace],
    projects: [project],
    prompts: [prompt],
    contexts: [context],
    recipes: [recipe],
    trails: [trail],
    runs: [run],
    links: [link],
  },
  expectedCounts: {
    workspaces: 1,
    projects: 1,
    prompts: 1,
    contexts: 1,
    recipes: 1,
    trails: 1,
    runs: 1,
    links: 1,
  },
  expectations: {
    dashboard: {
      recentRunIds: [run.id],
      relatedLinkCounts: [{ runId: run.id, count: 1 }],
    },
    runDetail: { urlFallbackLinkIds: [link.id] },
  },
};
