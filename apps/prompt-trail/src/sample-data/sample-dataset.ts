import type {
  Context,
  Link,
  Project,
  Prompt,
  Recipe,
  Run,
  UtcDateTimeString,
} from '../domain';

import { SAMPLE_IDS } from './sample-ids';

const utc = (value: string): UtcDateTimeString => value as UtcDateTimeString;

export const SAMPLE_DATASET_SCENARIO = {
  title: 'PromptTrail Development / Roadmap再同期 Trail',
  description:
    'PromptTrail開発プロジェクトで、AI駆動開発ルールをContextとして参照し、GitHub Issue作成PromptをCodex開発依頼Recipeに組み込み、Roadmap再同期RunからChat・Issue・PRへつながるPhase 0動作証明用Trail。',
} as const;

export const SAMPLE_DATASET_TIMELINE = {
  projectCreatedAt: utc('2026-07-12T00:00:00.000Z'),
  assetsCreatedAt: utc('2026-07-12T00:10:00.000Z'),
  recipeCreatedAt: utc('2026-07-12T00:20:00.000Z'),
  runStartedAt: utc('2026-07-12T00:30:00.000Z'),
  chatLinkedAt: utc('2026-07-12T00:35:00.000Z'),
  issueLinkedAt: utc('2026-07-12T00:40:00.000Z'),
  prLinkedAt: utc('2026-07-12T00:50:00.000Z'),
  runUpdatedAt: utc('2026-07-12T01:00:00.000Z'),
} as const;

export const SAMPLE_EXPECTED_COUNTS = {
  projects: 1,
  prompts: 1,
  contexts: 1,
  recipes: 1,
  runs: 1,
  links: 3,
} as const;

export const sampleProject: Project = {
  id: SAMPLE_IDS.project,
  name: 'PromptTrail Development',
  description:
    'Phase 0のPromptTrail開発とRoadmap再同期を説明するサンプルProject。',
  tags: ['prompttrail', 'phase-0', 'sample'],
  repositoryUrl: 'https://github.com/yuyuyu0706/ai-workbench',
  createdAt: SAMPLE_DATASET_TIMELINE.projectCreatedAt,
  updatedAt: SAMPLE_DATASET_TIMELINE.runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

export const samplePrompt: Prompt = {
  id: SAMPLE_IDS.prompt,
  scope: 'project',
  projectId: SAMPLE_IDS.project,
  title: 'GitHub Issue作成依頼',
  body: 'Roadmap差分を確認し、Phase 0の後続作業をGitHub Issueとして作成してください。対象範囲、非対象範囲、完了条件を明確にしてください。',
  kind: 'issue-creation',
  status: 'active',
  tags: ['github', 'issue', 'planning'],
  createdAt: SAMPLE_DATASET_TIMELINE.assetsCreatedAt,
  updatedAt: SAMPLE_DATASET_TIMELINE.assetsCreatedAt,
  deletedAt: null,
};

export const sampleContext: Context = {
  id: SAMPLE_IDS.context,
  scope: 'project',
  projectId: SAMPLE_IDS.project,
  title: 'AI駆動開発ルール',
  body: 'Issueの対象範囲だけを実装し、Seed、Repository、UIなど後続Issueの責務を先取りしない。Stable IDと固定時刻で再現性を保つ。',
  kind: 'development-rules',
  status: 'enabled',
  tags: ['rules', 'ai-development', 'scope-control'],
  createdAt: SAMPLE_DATASET_TIMELINE.assetsCreatedAt,
  updatedAt: SAMPLE_DATASET_TIMELINE.assetsCreatedAt,
  deletedAt: null,
};

export const sampleRecipe: Recipe = {
  id: SAMPLE_IDS.recipe,
  projectId: SAMPLE_IDS.project,
  title: 'Codex開発依頼',
  description:
    'GitHub Issue作成依頼PromptとAI駆動開発ルールContextを組み合わせるRecipe。',
  promptId: SAMPLE_IDS.prompt,
  contextIds: [SAMPLE_IDS.context],
  createdAt: SAMPLE_DATASET_TIMELINE.recipeCreatedAt,
  updatedAt: SAMPLE_DATASET_TIMELINE.recipeCreatedAt,
  deletedAt: null,
};

export const sampleRun: Run = {
  id: SAMPLE_IDS.run,
  projectId: SAMPLE_IDS.project,
  recipeId: SAMPLE_IDS.recipe,
  promptSnapshot: {
    promptId: SAMPLE_IDS.prompt,
    title: samplePrompt.title,
    body: samplePrompt.body,
  },
  contextSnapshots: [
    {
      contextId: SAMPLE_IDS.context,
      title: sampleContext.title,
      body: sampleContext.body,
    },
  ],
  inputValues: {
    roadmapTarget: 'Phase 0',
    sourceIssue: 100,
    resultPullRequest: 101,
  },
  finalPrompt: `${sampleContext.body}\n\n${samplePrompt.body}`,
  status: 'done',
  evaluation: 'good',
  improvementNote:
    '後続IssueでSeed実装とDashboard表示を分離する方針を確認できた。',
  createdAt: SAMPLE_DATASET_TIMELINE.runStartedAt,
  updatedAt: SAMPLE_DATASET_TIMELINE.runUpdatedAt,
  deletedAt: null,
  archivedAt: null,
};

export const sampleLinks: readonly Link[] = [
  {
    id: SAMPLE_IDS.links.chat,
    runId: SAMPLE_IDS.run,
    url: 'https://chatgpt.com/share/sample-prompttrail-roadmap-resync',
    title: 'Roadmap再同期 Chat',
    type: 'chat',
    role: 'source',
    summary: 'Roadmap再同期方針を相談したChat。',
    externalId: 'sample-prompttrail-roadmap-resync',
    createdAt: SAMPLE_DATASET_TIMELINE.chatLinkedAt,
    updatedAt: SAMPLE_DATASET_TIMELINE.chatLinkedAt,
    deletedAt: null,
  },
  {
    id: SAMPLE_IDS.links.issue100,
    runId: SAMPLE_IDS.run,
    url: 'https://github.com/yuyuyu0706/ai-workbench/issues/100',
    title: 'Roadmap再同期 Issue #100',
    type: 'issue',
    role: 'execution',
    summary: 'Phase 0 Roadmap再同期の実行単位。',
    externalId: '100',
    createdAt: SAMPLE_DATASET_TIMELINE.issueLinkedAt,
    updatedAt: SAMPLE_DATASET_TIMELINE.issueLinkedAt,
    deletedAt: null,
  },
  {
    id: SAMPLE_IDS.links.pr101,
    runId: SAMPLE_IDS.run,
    url: 'https://github.com/yuyuyu0706/ai-workbench/pull/101',
    title: 'Roadmap再同期 PR #101',
    type: 'pull-request',
    role: 'result',
    summary: 'Roadmap再同期の成果PR。',
    externalId: '101',
    createdAt: SAMPLE_DATASET_TIMELINE.prLinkedAt,
    updatedAt: SAMPLE_DATASET_TIMELINE.prLinkedAt,
    deletedAt: null,
  },
] as const;

export const sampleDataset = {
  scenario: SAMPLE_DATASET_SCENARIO,
  ids: SAMPLE_IDS,
  expectedCounts: SAMPLE_EXPECTED_COUNTS,
  timeline: SAMPLE_DATASET_TIMELINE,
  project: sampleProject,
  prompt: samplePrompt,
  context: sampleContext,
  recipe: sampleRecipe,
  run: sampleRun,
  links: sampleLinks,
} as const;
