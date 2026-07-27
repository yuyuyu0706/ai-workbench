import {
  createDefaultProject,
  DEFAULT_PROJECT_ID,
  type Link,
  type Prompt,
  type Run,
  type RunStatus,
} from '../../domain';
import type { DeveloperDataScenario } from '../developer-data-scenario';
import { scenarioValue } from '../scenario-ids';

const projectCreatedAt = scenarioValue.utc('2026-08-03T00:00:00.000Z');

type DenseRunSpec = {
  readonly sequence: string;
  readonly title: string;
  readonly body: string;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const runSpecs: readonly DenseRunSpec[] = [
  {
    sequence: '01',
    title:
      '長いTrail名と複数行PromptがDashboardおよびRun Detailで安全に折り返され、情報階層を崩さないことを確認するための開発用シナリオ',
    body: 'Dashboardの最新5件表示を確認してください。\n長いタイトル、長い本文、関連Linkの件数が画面幅を超えないことも確認してください。',
    status: 'in-progress',
    createdAt: '2026-08-03T00:10:00.000Z',
    updatedAt: '2026-08-03T07:00:00.000Z',
  },
  {
    sequence: '02',
    title: 'Developer ToolsのデータScenario設計をレビューする',
    body: 'Scenario Catalogの型、期待件数、参照関係をレビューしてください。',
    status: 'done',
    createdAt: '2026-08-03T00:20:00.000Z',
    updatedAt: '2026-08-03T06:00:00.000Z',
  },
  {
    sequence: '03',
    title: 'ローカルDB初期化の受入条件を整理する',
    body: 'ResetとReset & Loadの安全性、確認UI、rollback条件を整理してください。',
    status: 'prepared',
    createdAt: '2026-08-03T00:30:00.000Z',
    updatedAt: '2026-08-03T05:00:00.000Z',
  },
  {
    sequence: '04',
    title: '関連Link件数と論理削除の表示を確認する',
    body: 'active Linkとsoft delete済みLinkの件数差を確認してください。',
    status: 'executed',
    createdAt: '2026-08-03T00:40:00.000Z',
    updatedAt: '2026-08-03T04:00:00.000Z',
  },
  {
    sequence: '05',
    title: '長いURLの折り返しを確認する',
    body: '長いURLが320px幅でもhorizontal overflowを起こさないことを確認してください。',
    status: 'draft',
    createdAt: '2026-08-03T00:50:00.000Z',
    updatedAt: '2026-08-03T03:00:00.000Z',
  },
  {
    sequence: '06',
    title: '最新5件より古いTrailが一覧から除外されることを確認する',
    body: '6件目のRunがDashboardの最新5件へ表示されないことを確認してください。',
    status: 'done',
    createdAt: '2026-08-03T01:00:00.000Z',
    updatedAt: '2026-08-03T02:00:00.000Z',
  },
  {
    sequence: '07',
    title: '最も古いTrailの固定データを確認する',
    body: '固定時刻とStable IDが実行ごとに変化しないことを確認してください。',
    status: 'prepared',
    createdAt: '2026-08-03T01:10:00.000Z',
    updatedAt: '2026-08-03T01:30:00.000Z',
  },
];

const prompts: readonly Prompt[] = runSpecs.map((spec) => ({
  id: scenarioValue.promptId(`developer-dense-prompt-${spec.sequence}`),
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
  title: spec.title,
  body: spec.body,
  kind: 'other',
  status: 'active',
  tags: ['developer-data', 'dense'],
  createdAt: scenarioValue.utc(spec.createdAt),
  updatedAt: scenarioValue.utc(spec.createdAt),
  deletedAt: null,
}));

const runs: readonly Run[] = runSpecs.map((spec, index) => {
  const prompt = prompts[index];
  if (prompt === undefined) {
    throw new Error(`Dense Prompt is missing for sequence: ${spec.sequence}`);
  }

  return {
    id: scenarioValue.runId(`developer-dense-run-${spec.sequence}`),
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
    status: spec.status,
    evaluation: spec.status === 'done' ? 'good' : null,
    improvementNote: null,
    createdAt: scenarioValue.utc(spec.createdAt),
    updatedAt: scenarioValue.utc(spec.updatedAt),
    deletedAt: null,
    archivedAt: null,
  };
});

const runBySequence = (sequence: string): Run => {
  const run = runs.find((candidate) => candidate.id.endsWith(`-${sequence}`));
  if (run === undefined) throw new Error(`Dense Run not found: ${sequence}`);
  return run;
};

type DenseLinkSpec = {
  readonly sequence: string;
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly type: Link['type'];
  readonly externalId: string | null;
  readonly createdAt: string;
  readonly deletedAt?: string;
};

const linkSpecs: readonly DenseLinkSpec[] = [
  {
    sequence: '02',
    id: 'issue',
    url: 'https://github.com/yuyuyu0706/ai-workbench/issues/178',
    title: 'Developer Data親Issue',
    type: 'issue',
    externalId: '178',
    createdAt: '2026-08-03T00:25:00.000Z',
  },
  {
    sequence: '03',
    id: 'chat',
    url: 'https://chatgpt.com/share/developer-dense-reset-design',
    title: '初期化設計 Chat',
    type: 'chat',
    externalId: 'developer-dense-reset-design',
    createdAt: '2026-08-03T00:35:00.000Z',
  },
  {
    sequence: '03',
    id: 'document',
    url: 'https://example.com/prompt-trail/developer-tools/reset-contract',
    title: 'Reset Contract',
    type: 'document',
    externalId: null,
    createdAt: '2026-08-03T00:36:00.000Z',
  },
  {
    sequence: '04',
    id: 'issue',
    url: 'https://github.com/yuyuyu0706/ai-workbench/issues/175',
    title: 'Link削除 Issue',
    type: 'issue',
    externalId: '175',
    createdAt: '2026-08-03T00:45:00.000Z',
  },
  {
    sequence: '04',
    id: 'pr',
    url: 'https://github.com/yuyuyu0706/ai-workbench/pull/176',
    title: 'Link削除 Pull Request',
    type: 'pull-request',
    externalId: '176',
    createdAt: '2026-08-03T00:46:00.000Z',
  },
  {
    sequence: '04',
    id: 'commit',
    url: 'https://github.com/yuyuyu0706/ai-workbench/commit/3b5167258aefd83372ecba162b482e911c012508',
    title: 'Link削除 Merge Commit',
    type: 'commit',
    externalId: '3b5167258aefd83372ecba162b482e911c012508',
    createdAt: '2026-08-03T00:47:00.000Z',
  },
  {
    sequence: '04',
    id: 'deleted',
    url: 'https://example.com/prompt-trail/deleted-link',
    title: '削除済み関連Link',
    type: 'external',
    externalId: null,
    createdAt: '2026-08-03T00:48:00.000Z',
    deletedAt: '2026-08-03T08:00:00.000Z',
  },
  {
    sequence: '05',
    id: 'long-url',
    url: 'https://example.com/prompt-trail/developer-tools/scenarios/dense/very-long-path-segment-for-responsive-layout-verification?source=developer-data&viewport=320&expected=without-horizontal-overflow',
    title:
      '320px幅で長いLink名称とURLが折り返され、一覧全体へhorizontal overflowを発生させないことを確認する関連資料',
    type: 'document',
    externalId: null,
    createdAt: '2026-08-03T00:55:00.000Z',
  },
  {
    sequence: '07',
    id: 'release',
    url: 'https://github.com/yuyuyu0706/ai-workbench/releases/tag/developer-data-v1',
    title: 'Developer Data Contract Release',
    type: 'release',
    externalId: 'developer-data-v1',
    createdAt: '2026-08-03T01:15:00.000Z',
  },
];

const links: readonly Link[] = linkSpecs.map((spec) => {
  const createdAt = scenarioValue.utc(spec.createdAt);
  return {
    id: scenarioValue.linkId(
      `developer-dense-link-${spec.sequence}-${spec.id}`,
    ),
    runId: runBySequence(spec.sequence).id,
    url: spec.url,
    title: spec.title,
    type: spec.type,
    role: null,
    summary: null,
    externalId: spec.externalId,
    createdAt,
    updatedAt: createdAt,
    deletedAt:
      spec.deletedAt === undefined ? null : scenarioValue.utc(spec.deletedAt),
  };
});

const [run01, run02, run03, run04, run05, run06, run07] = [
  runBySequence('01'),
  runBySequence('02'),
  runBySequence('03'),
  runBySequence('04'),
  runBySequence('05'),
  runBySequence('06'),
  runBySequence('07'),
];

export const denseScenario: DeveloperDataScenario = {
  id: 'dense',
  label: 'Dense',
  description: '一覧密度、更新順、長文、長いURL、関連Link件数を確認する状態。',
  dataset: {
    projects: [createDefaultProject(projectCreatedAt)],
    prompts,
    contexts: [],
    recipes: [],
    runs,
    links,
  },
  expectedCounts: {
    projects: 1,
    prompts: 7,
    contexts: 0,
    recipes: 0,
    runs: 7,
    links: 9,
  },
  expectations: {
    dashboard: {
      recentRunIds: [run01.id, run02.id, run03.id, run04.id, run05.id],
      relatedLinkCounts: [
        { runId: run01.id, count: 0 },
        { runId: run02.id, count: 1 },
        { runId: run03.id, count: 2 },
        { runId: run04.id, count: 3 },
        { runId: run05.id, count: 1 },
        { runId: run06.id, count: 0 },
        { runId: run07.id, count: 1 },
      ],
    },
    runDetail: {
      urlFallbackLinkIds: [],
    },
  },
};
