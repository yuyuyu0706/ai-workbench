import type {
  ContextId,
  LinkId,
  ProjectId,
  PromptId,
  RecipeId,
  RunId,
} from '../domain';

export const SAMPLE_IDS = {
  project: 'sample-project-prompttrail-development' as ProjectId,
  prompt: 'sample-prompt-github-issue-request' as PromptId,
  context: 'sample-context-ai-driven-development' as ContextId,
  recipe: 'sample-recipe-codex-development-request' as RecipeId,
  run: 'sample-run-roadmap-resync' as RunId,
  links: {
    chat: 'sample-link-chat' as LinkId,
    issue100: 'sample-link-issue-100' as LinkId,
    pr101: 'sample-link-pr-101' as LinkId,
  },
} as const;

export const SAMPLE_ID_SET = new Set<string>([
  SAMPLE_IDS.project,
  SAMPLE_IDS.prompt,
  SAMPLE_IDS.context,
  SAMPLE_IDS.recipe,
  SAMPLE_IDS.run,
  SAMPLE_IDS.links.chat,
  SAMPLE_IDS.links.issue100,
  SAMPLE_IDS.links.pr101,
]);
