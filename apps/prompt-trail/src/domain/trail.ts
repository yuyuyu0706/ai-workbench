import type { ArchivableEntity, BaseEntity, ProjectId } from './common';

export const TRAIL_KINDS = [
  'planning-design',
  'development',
  'research',
  'review',
  'incident-response',
  'other',
] as const;

export type TrailKind = (typeof TRAIL_KINDS)[number];

/**
 * Independent unit of work that groups one or more Runs.
 *
 * Trail always belongs to a Project; it has no AssetScope of its own and
 * reaches its Workspace indirectly through `projectId`. PromptSnapshot stays
 * on Run, not on Trail. Execution status is not modeled yet.
 */
export interface Trail extends BaseEntity<'trail'>, ArchivableEntity {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly kind: TrailKind;
}
