export const PROMPT_TRAIL_DB_NAME = 'prompt-trail';

export const PROMPT_TRAIL_SCHEMA_VERSION = 1;

export const PROMPT_TRAIL_STORE_NAMES = [
  'projects',
  'prompts',
  'contexts',
  'recipes',
  'runs',
  'links',
] as const;

export type PromptTrailStoreName = (typeof PROMPT_TRAIL_STORE_NAMES)[number];
