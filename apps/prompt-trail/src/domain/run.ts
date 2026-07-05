import type {
  ArchivableEntity,
  BaseEntity,
  ContextId,
  ProjectId,
  PromptId,
  RecipeId,
} from './common';

export const RUN_STATUSES = [
  'draft',
  'prepared',
  'executed',
  'in-progress',
  'done',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_EVALUATIONS = ['good', 'needs-improvement', 'failed'] as const;

export type RunEvaluation = (typeof RUN_EVALUATIONS)[number];

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Prompt contents frozen at the time a Run is prepared or executed. */
export interface PromptSnapshot {
  readonly promptId: PromptId;
  readonly title: string;
  readonly body: string;
}

/** Context contents frozen at the time a Run is prepared or executed. */
export interface ContextSnapshot {
  readonly contextId: ContextId;
  readonly title: string;
  readonly body: string;
}

/**
 * Execution evidence created from a Recipe.
 *
 * Run stores immutable snapshots and the final composed prompt so past work can
 * be reproduced even after the source Prompt or Context assets change.
 */
export interface Run extends BaseEntity<'run'>, ArchivableEntity {
  readonly projectId: ProjectId;
  readonly recipeId: RecipeId;
  readonly promptSnapshot: PromptSnapshot;
  /** Context snapshots preserve the same order selected by the source Recipe. */
  readonly contextSnapshots: readonly ContextSnapshot[];
  /** JSON-compatible values keyed by Recipe variable name. Empty input is {}. */
  readonly inputValues: { readonly [variableName: string]: JsonValue };
  readonly finalPrompt: string;
  readonly status: RunStatus;
  readonly evaluation: RunEvaluation | null;
  readonly improvementNote: string | null;
}
