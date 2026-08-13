import { DEFAULT_WORKSPACE_ID } from './workspace';
import type {
  ArchivableEntity,
  BaseEntity,
  ProjectId,
  UtcDateTimeString,
  WorkspaceId,
} from './common';

/** Stable Project ownership boundary used by the Public Alpha Direct Run flow. */
export const DEFAULT_PROJECT_ID = 'prompt-trail-default-project' as ProjectId;

/** Creates the complete default Project record required by the Direct Run flow. */
export function createDefaultProject(createdAt: UtcDateTimeString): Project {
  return {
    id: DEFAULT_PROJECT_ID,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null,
    workspaceId: DEFAULT_WORKSPACE_ID,
    name: 'Default Project',
    description: null,
    tags: [],
    repositoryUrl: null,
  };
}

/**
 * Work unit that groups Prompt Trail assets and their outcomes.
 *
 * Project itself is not scoped as a global/project asset; it is the ownership
 * boundary referenced by project-scoped assets, and it belongs to exactly one
 * Workspace.
 */
export interface Project extends BaseEntity<'project'>, ArchivableEntity {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly repositoryUrl: string | null;
}
