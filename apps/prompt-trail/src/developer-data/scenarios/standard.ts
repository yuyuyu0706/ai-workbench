import {
  createDefaultProject,
  DEFAULT_PROJECT_ID,
  type Link,
  type Prompt,
  type Run,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { scenarioValue } from '../scenario-ids';

const createdAt = scenarioValue.utc('2026-08-01T00:00:00.000Z');
const promptCreatedAt = scenarioValue.utc('2026-08-01T00:10:00.000Z');
const runCreatedAt = scenarioValue.utc('2026-08-01T00:20:00.000Z');
const chatLinkedAt = scenarioValue.utc('2026-08-01T00:25:00.000Z');
const issueLinkedAt = scenarioValue.utc('2026-08-01T00:28:00.000Z');
const runUpdatedAt = scenarioValue.utc('2026-08-01T00:30:00.000Z');

const prompt: Prompt = {
  id: scenarioValue.promptId('developer-standard-prompt-main'),
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
  title: 'PromptTrailの開発Issueを整理する',
  body: '開発テーマを整理し、対象範囲・非対象・完了条件を明確にしたGitHub Issueを作成してください。',
  kind: 'issue-creation',
  status: 'active',
  tags: ['developer-data', 'standard'],
  createdAt: promptCreatedAt,
  updatedAt: promptCreatedAt,
  deletedAt: null,
};

const run: Run = {
  id: scenarioValue.runId('developer-standard-run-main'),
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
  createdAt: runCreatedAt,
  updatedAt: runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

const links: readonly Link[] = [
  {
    id: scenarioValue.linkId('developer-standard-link-chat'),
    runId: run.id,
    url: 'https://chatgpt.com/share/developer-standard-trail',
    title: 'Issue設計 Chat',
    type: 'chat',
    role: null,
    summary: null,
    externalId: 'developer-standard-trail',
    createdAt: chatLinkedAt,
    updatedAt: chatLinkedAt,
    deletedAt: null,
  },
  {
    id: scenarioValue.linkId('developer-standard-link-issue'),
    runId: run.id,
    url: 'https://github.com/yuyuyu0706/ai-workbench/issues/179',
    title: 'Scenario Catalog Issue',
    type: 'issue',
    role: null,
    summary: null,
    externalId: '179',
    createdAt: issueLinkedAt,
    updatedAt: issueLinkedAt,
    deletedAt: null,
  },
];

export const standardScenario: DeveloperDataScenario = {
  id: 'standard',
  label: 'Standard',
  description: 'P1-1の現在仕様を代表するDirect Runと名称付きLinkの最小Trail。',
  dataset: {
    projects: [createDefaultProject(createdAt)],
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
