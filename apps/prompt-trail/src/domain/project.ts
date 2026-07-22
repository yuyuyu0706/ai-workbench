import type { ArchivableEntity, BaseEntity, ProjectId } from './common';

/** Stable Project ownership boundary used by the Public Alpha Direct Run flow. */
export const DEFAULT_PROJECT_ID = 'prompt-trail-default-project' as ProjectId;

/**
 * Work unit that groups Prompt Trail assets and their outcomes.
 *
 * Project itself is not scoped as a global/project asset; it is the ownership
 * boundary referenced by project-scoped assets.
 */
export interface Project extends BaseEntity<'project'>, ArchivableEntity {
  readonly name: string;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly repositoryUrl: string | null;
}
