import type { AssetScope, BaseEntity } from './common';

export const PROMPT_KINDS = [
  'chat-consultation',
  'codex-request',
  'issue-creation',
  'design-review',
  'incident-analysis',
  'other',
] as const;

export type PromptKind = (typeof PROMPT_KINDS)[number];

export const PROMPT_STATUSES = ['draft', 'active', 'deprecated'] as const;

export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/** Reusable Markdown request template for AI work. */
export type Prompt = BaseEntity<'prompt'> &
  AssetScope & {
    readonly title: string;
    readonly body: string;
    readonly kind: PromptKind;
    readonly status: PromptStatus;
    readonly tags: readonly string[];
  };
