import type { AssetScope, BaseEntity } from './common';

export const CONTEXT_KINDS = [
  'project-overview',
  'technical-architecture',
  'development-rules',
  'glossary',
  'output-rules',
  'other',
] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export const CONTEXT_STATUSES = ['enabled', 'disabled'] as const;

export type ContextStatus = (typeof CONTEXT_STATUSES)[number];

/** Reusable Markdown knowledge asset for background, constraints, or rules. */
export type Context = BaseEntity<'context'> &
  AssetScope & {
    readonly title: string;
    readonly body: string;
    readonly kind: ContextKind;
    readonly status: ContextStatus;
    readonly tags: readonly string[];
  };
