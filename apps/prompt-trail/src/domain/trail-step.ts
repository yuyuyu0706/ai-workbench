import type { BaseEntity, PromptId, TrailId } from './common';

export const TRAIL_STEP_KINDS = ['prompt', 'manual'] as const;

export type TrailStepKind = (typeof TRAIL_STEP_KINDS)[number];

/**
 * One ordered step in a Trail's Prompt flow.
 *
 * Step keeps references only. Prompt body and other Prompt fields are
 * intentionally not copied here; Run snapshots freeze those values when a
 * Step is executed. `ArchivableEntity` is intentionally not composed in:
 * Step is archived through its owning Trail, so it needs no archive state
 * of its own.
 */
export interface TrailStep extends BaseEntity<'trail-step'> {
  readonly trailId: TrailId;
  /** 1-based, sequential, and unique within the owning Trail. */
  readonly order: number;
  readonly kind: TrailStepKind;
  /** Step name. Independent of the referenced Prompt's title. */
  readonly title: string;
  /** Required when kind is 'prompt'; null when kind is 'manual'. */
  readonly promptId: PromptId | null;
  readonly note: string | null;
}
