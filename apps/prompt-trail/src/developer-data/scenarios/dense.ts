import type {
  Link,
  Project,
  Prompt,
  Run,
  RunStatus,
  Trail,
  Workspace,
} from '../../domain';
import { DEFAULT_WORKSPACE_ID, createDefaultWorkspace } from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { linkId, projectId, promptId, runId, trailId, utc } from './helpers';

const workspace: Workspace = createDefaultWorkspace(
  utc('2026-07-22T08:00:00.000Z'),
);
const project: Project = {
  id: projectId('dense-project-dashboard'),
  workspaceId: DEFAULT_WORKSPACE_ID,
  name: 'Dense dashboard project',
  description: 'A deterministic high-density dashboard fixture.',
  tags: ['dense'],
  repositoryUrl: 'https://github.com/yuyuyu0706/ai-workbench',
  createdAt: utc('2026-07-22T08:00:00.000Z'),
  updatedAt: utc('2026-07-22T08:00:00.000Z'),
  deletedAt: null,
  archivedAt: null,
};
const prompt: Prompt = {
  id: promptId('dense-prompt-long-dashboard-request'),
  scope: 'project',
  projectId: project.id,
  title:
    'A deliberately long Prompt title for checking dense dashboard layouts without depending on CSS implementation details',
  body: 'First, review all supplied evidence.\n\nSecond, compare the alternatives.\n\nFinally, provide a concise recommendation with risks.',
  status: 'active',
  tags: ['dense', 'long-content'],
  variableValues: {},
  createdAt: project.createdAt,
  updatedAt: project.createdAt,
  deletedAt: null,
};
const statuses: readonly RunStatus[] = [
  'done',
  'in-progress',
  'executed',
  'prepared',
  'draft',
  'done',
  'executed',
];
const runsAndTrails = statuses.map((status, index) => {
  const ordinal = index + 1;
  const updatedAt = utc(
    `2026-07-22T${String(9 + index).padStart(2, '0')}:00:00.000Z`,
  );
  const trail: Trail = {
    id: trailId(`dense-trail-${ordinal}`),
    projectId: project.id,
    title: prompt.title,
    kind: 'other',
    createdAt: utc(
      `2026-07-22T${String(8 + index).padStart(2, '0')}:30:00.000Z`,
    ),
    updatedAt,
    deletedAt: null,
    archivedAt: null,
  };
  const run: Run = {
    id: runId(`dense-run-${ordinal}`),
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
    status,
    evaluation: status === 'done' ? 'good' : null,
    improvementNote: null,
    output: null,
    messages: [],
    createdAt: utc(
      `2026-07-22T${String(8 + index).padStart(2, '0')}:30:00.000Z`,
    ),
    updatedAt,
    deletedAt: null,
    archivedAt: null,
  };
  return { run, trail };
});
const runs: readonly Run[] = runsAndTrails.map(({ run }) => run);
const trails: readonly Trail[] = runsAndTrails.map(({ trail }) => trail);
const links: readonly Link[] = [
  {
    id: linkId('dense-link-run-2-single'),
    runId: runs[1].id,
    url: 'https://example.com/dense/single',
    title: 'Single related result',
    type: 'document',
    role: 'result',
    summary: null,
    externalId: null,
    createdAt: runs[1].createdAt,
    updatedAt: runs[1].updatedAt,
    deletedAt: null,
  },
  {
    id: linkId('dense-link-run-3-first'),
    runId: runs[2].id,
    url: 'https://example.com/dense/a/very/long/path/that/exercises/url/display/without/runtime/generation?source=developer-data&scenario=dense',
    title:
      'A very long named reference used to exercise high-density result presentation',
    type: 'external',
    role: 'reference',
    summary: null,
    externalId: null,
    createdAt: runs[2].createdAt,
    updatedAt: runs[2].updatedAt,
    deletedAt: null,
  },
  {
    id: linkId('dense-link-run-3-second'),
    runId: runs[2].id,
    url: 'https://example.com/dense/second',
    title: 'Second related result',
    type: 'document',
    role: 'output',
    summary: null,
    externalId: null,
    createdAt: runs[2].createdAt,
    updatedAt: runs[2].updatedAt,
    deletedAt: null,
  },
  {
    id: linkId('dense-link-run-4-deleted'),
    runId: runs[3].id,
    url: 'https://example.com/dense/deleted',
    title: 'Soft-deleted result',
    type: 'document',
    role: 'result',
    summary: null,
    externalId: null,
    createdAt: runs[3].createdAt,
    updatedAt: runs[3].updatedAt,
    deletedAt: utc('2026-07-22T16:30:00.000Z'),
  },
];
const recentRuns = [...runs]
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 5);

export const denseScenario: DeveloperDataScenario = {
  id: 'dense',
  label: 'Dense dashboard',
  description:
    'Seven ordered Runs with varied statuses, link densities, deleted data, and long content.',
  dataset: {
    workspaces: [workspace],
    projects: [project],
    prompts: [prompt],
    contexts: [],
    recipes: [],
    trails,
    runs,
    links,
  },
  expectedCounts: {
    workspaces: 1,
    projects: 1,
    prompts: 1,
    contexts: 0,
    recipes: 0,
    trails: 7,
    runs: 7,
    links: 4,
  },
  expectations: {
    dashboard: {
      recentRunIds: recentRuns.map(({ id }) => id),
      relatedLinkCounts: recentRuns.map(({ id }) => ({
        runId: id,
        count: links.filter(
          (link) => link.runId === id && link.deletedAt === null,
        ).length,
      })),
    },
    runDetail: { urlFallbackLinkIds: [] },
  },
};
