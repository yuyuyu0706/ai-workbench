import {
  createDefaultProject,
  DEFAULT_PROJECT_ID,
  type Link,
  type Prompt,
  type Run,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { scenarioValue } from '../scenario-ids';

const projectCreatedAt = scenarioValue.utc('2026-08-02T00:00:00.000Z');
const promptCreatedAt = scenarioValue.utc('2026-08-02T00:10:00.000Z');
const runCreatedAt = scenarioValue.utc('2026-08-02T00:20:00.000Z');
const issueLinkedAt = scenarioValue.utc('2026-08-02T00:25:00.000Z');
const pullRequestLinkedAt = scenarioValue.utc('2026-08-02T00:30:00.000Z');
const runUpdatedAt = scenarioValue.utc('2026-08-02T00:40:00.000Z');

const prompt: Prompt = {
  id: scenarioValue.promptId('developer-reuse-ready-prompt-source'),
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
  title: '実装済みIssueをレビューする',
  body: '対象IssueとPull Requestを確認し、受入条件、回帰テスト、残課題をレビューしてください。',
  kind: 'design-review',
  status: 'active',
  tags: ['developer-data', 'reuse-ready'],
  createdAt: promptCreatedAt,
  updatedAt: promptCreatedAt,
  deletedAt: null,
};

const run: Run = {
  id: scenarioValue.runId('developer-reuse-ready-run-source'),
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
  status: 'done',
  evaluation: 'good',
  improvementNote: '次回は対象ファイルと重点確認箇所を追記して再利用する。',
  createdAt: runCreatedAt,
  updatedAt: runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

const links: readonly Link[] = [
  {
    id: scenarioValue.linkId('developer-reuse-ready-link-issue'),
    runId: run.id,
    url: 'https://github.com/yuyuyu0706/ai-workbench/issues/175',
    title: 'レビュー対象 Issue',
    type: 'issue',
    role: null,
    summary: null,
    externalId: '175',
    createdAt: issueLinkedAt,
    updatedAt: issueLinkedAt,
    deletedAt: null,
  },
  {
    id: scenarioValue.linkId('developer-reuse-ready-link-pr'),
    runId: run.id,
    url: 'https://github.com/yuyuyu0706/ai-workbench/pull/176',
    title: 'レビュー対象 Pull Request',
    type: 'pull-request',
    role: null,
    summary: null,
    externalId: '176',
    createdAt: pullRequestLinkedAt,
    updatedAt: pullRequestLinkedAt,
    deletedAt: null,
  },
];

export const reuseReadyScenario: DeveloperDataScenario = {
  id: 'reuse-ready',
  label: 'Reuse Ready',
  description: 'P1-3で編集・再利用する元Promptと完了済みTrailを確認する状態。',
  dataset: {
    projects: [createDefaultProject(projectCreatedAt)],
    prompts: [prompt],
    contexts: [],
    recipes: [],
    runs: [run],
    links,
  },
  expectedCounts: {
    projects: 1,
    prompts: 1,
    contexts: 0,
    recipes: 0,
    runs: 1,
    links: 2,
  },
  expectations: {
    dashboard: {
      recentRunIds: [run.id],
      relatedLinkCounts: [{ runId: run.id, count: 2 }],
    },
    runDetail: {
      urlFallbackLinkIds: [],
    },
  },
};
