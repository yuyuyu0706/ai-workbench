export const PROMPT_TRAIL_DB_NAME = 'prompt-trail';

export const PROMPT_TRAIL_SCHEMA_VERSION = 8;

export const PROMPT_TRAIL_STORE_NAMES = [
  'projects',
  'prompts',
  'contexts',
  'recipes',
  'runs',
  'links',
  'workspaces',
  'trails',
] as const;

export type PromptTrailStoreName = (typeof PROMPT_TRAIL_STORE_NAMES)[number];
