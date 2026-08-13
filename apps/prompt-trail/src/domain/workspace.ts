import type { BaseEntity, UtcDateTimeString, WorkspaceId } from './common';

/** Stable Workspace ownership boundary. Only one Workspace exists today. */
export const DEFAULT_WORKSPACE_ID =
  'prompt-trail-default-workspace' as WorkspaceId;

/** Creates the complete default Workspace record required by every Project. */
export function createDefaultWorkspace(
  createdAt: UtcDateTimeString,
): Workspace {
  return {
    id: DEFAULT_WORKSPACE_ID,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    name: 'Default Workspace',
  };
}

/**
 * Top-level ownership boundary above Project.
 *
 * Only Default Workspace exists today; the model is deliberately shaped for
 * future multi-workspace support rather than added as a shortcut.
 */
export interface Workspace extends BaseEntity<'workspace'> {
  readonly name: string;
}
