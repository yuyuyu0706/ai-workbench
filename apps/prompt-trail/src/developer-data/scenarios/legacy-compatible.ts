import type {
  Context,
  Link,
  Project,
  Prompt,
  Recipe,
  Run,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { scenarioValue } from '../scenario-ids';

const projectId = scenarioValue.projectId('developer-legacy-project');
const promptId = scenarioValue.promptId('developer-legacy-prompt');
const contextId = scenarioValue.contextId('developer-legacy-context');
const recipeId = scenarioValue.recipeId('developer-legacy-recipe');
const runId = scenarioValue.runId('developer-legacy-run');

const projectCreatedAt = scenarioValue.utc('2026-08-04T00:00:00.000Z');
const assetsCreatedAt = scenarioValue.utc('2026-08-04T00:10:00.000Z');
const recipeCreatedAt = scenarioValue.utc('2026-08-04T00:20:00.000Z');
const runCreatedAt = scenarioValue.utc('2026-08-04T00:30:00.000Z');
const externalLinkedAt = scenarioValue.utc('2026-08-04T00:35:00.000Z');
const documentLinkedAt = scenarioValue.utc('2026-08-04T00:40:00.000Z');
const runUpdatedAt = scenarioValue.utc('2026-08-04T00:50:00.000Z');

const project: Project = {
  id: projectId,
  name: 'Legacy Compatibility Project',
  description:
    '名称なしLink、既存role、external typeの読み取り互換を確認するProject。',
  tags: ['developer-data', 'legacy-compatible'],
  repositoryUrl: 'https://github.com/yuyuyu0706/ai-workbench',
  createdAt: projectCreatedAt,
  updatedAt: runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

const prompt: Prompt = {
  id: promptId,
  scope: 'project',
  projectId,
  title: '旧形式データの互換表示を確認する',
  body: '名称なしLink、既存role、external typeが現在の画面で安全に表示されることを確認してください。',
  kind: 'design-review',
  status: 'active',
  tags: ['developer-data', 'legacy-compatible'],
  createdAt: assetsCreatedAt,
  updatedAt: assetsCreatedAt,
  deletedAt: null,
};

const context: Context = {
  id: contextId,
  scope: 'project',
  projectId,
  title: '旧形式互換ルール',
  body: '保存済みのtitle null、文字列role、external typeを自動補完・正規化しない。',
  kind: 'development-rules',
  status: 'enabled',
  tags: ['legacy', 'compatibility'],
  createdAt: assetsCreatedAt,
  updatedAt: assetsCreatedAt,
  deletedAt: null,
};

const recipe: Recipe = {
  id: recipeId,
  projectId,
  title: '旧形式互換レビュー',
  description: '旧形式データをRecipe起点Runで確認する。',
  promptId,
  contextIds: [contextId],
  createdAt: recipeCreatedAt,
  updatedAt: recipeCreatedAt,
  deletedAt: null,
};

const run: Run = {
  id: runId,
  projectId,
  recipeId,
  promptSnapshot: {
    promptId,
    title: prompt.title,
    body: prompt.body,
  },
  contextSnapshots: [
    {
      contextId,
      title: context.title,
      body: context.body,
    },
  ],
  inputValues: {
    compatibilityTarget: 'saved-link-contract',
  },
  finalPrompt: `${context.body}\n\n${prompt.body}`,
  status: 'done',
  evaluation: 'good',
  improvementNote: null,
  createdAt: runCreatedAt,
  updatedAt: runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

const untitledLinkId = scenarioValue.linkId(
  'developer-legacy-link-untitled-external',
);

const links: readonly Link[] = [
  {
    id: untitledLinkId,
    runId,
    url: 'https://example.com/prompt-trail/legacy/untitled-external-link',
    title: null,
    type: 'external',
    role: 'source',
    summary: 'P1-1以前に保存された名称なし外部Link。',
    externalId: null,
    createdAt: externalLinkedAt,
    updatedAt: externalLinkedAt,
    deletedAt: null,
  },
  {
    id: scenarioValue.linkId('developer-legacy-link-named-document'),
    runId,
    url: 'https://example.com/prompt-trail/legacy/compatibility-notes',
    title: '旧形式互換メモ',
    type: 'document',
    role: 'result',
    summary: '既存文字列roleを保持した名称付きLink。',
    externalId: null,
    createdAt: documentLinkedAt,
    updatedAt: documentLinkedAt,
    deletedAt: null,
  },
];

export const legacyCompatibleScenario: DeveloperDataScenario = {
  id: 'legacy-compatible',
  label: 'Legacy Compatible',
  description:
    '名称なしLink、既存role、external typeの読み取り互換を確認する状態。',
  dataset: {
    projects: [project],
    prompts: [prompt],
    contexts: [context],
    recipes: [recipe],
    runs: [run],
    links,
  },
  expectedCounts: {
    projects: 1,
    prompts: 1,
    contexts: 1,
    recipes: 1,
    runs: 1,
    links: 2,
  },
  expectations: {
    dashboard: {
      recentRunIds: [runId],
      relatedLinkCounts: [{ runId, count: 2 }],
    },
    runDetail: {
      urlFallbackLinkIds: [untitledLinkId],
    },
  },
};
