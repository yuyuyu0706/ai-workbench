import type { BaseEntity, ContextId, ProjectId, PromptId } from './common';

/**
 * Mutable working recipe that reuses one Prompt and an ordered list of Contexts.
 *
 * Recipe keeps references only. Prompt and Context bodies, statuses, and scopes
 * are intentionally not copied here; Run snapshots freeze those values when a
 * recipe is executed.
 */
export interface Recipe extends BaseEntity<'recipe'> {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description: string | null;
  readonly promptId: PromptId;
  /** Context IDs in the order they should be applied when composing a final prompt. */
  readonly contextIds: readonly ContextId[];
}
