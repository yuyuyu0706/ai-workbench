import type { AssetScope, BaseEntity } from './common';

export const PROMPT_STATUSES = ['draft', 'active', 'deprecated'] as const;

export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/** Reusable Markdown request template for AI work. */
export type Prompt = BaseEntity<'prompt'> &
  AssetScope & {
    readonly title: string;
    readonly body: string;
    readonly status: PromptStatus;
    readonly tags: readonly string[];
    readonly variableValues: Record<string, string>;
  };
