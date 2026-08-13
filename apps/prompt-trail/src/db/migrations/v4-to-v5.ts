import type { Transaction } from 'dexie';

import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_ID,
  type ProjectId,
  type TrailKind,
  type UtcDateTimeString,
} from '../../domain';

/** The persisted Run shape before Trail became an independent Store. */
interface LegacyRunV4 {
  readonly id: string;
  readonly projectId: ProjectId;
  trailTitle?: string;
  trailKind?: TrailKind;
  trailId?: string;
}

/** The persisted Project shape before Workspace became an independent Store. */
interface LegacyProjectV4 {
  workspaceId?: string;
}

/**
 * Upgrades schema v4 to v5.
 *
 * Creates the Default Workspace, backfills every Project with its
 * `workspaceId`, backfills one Trail per existing Run from its legacy
 * `trailTitle`/`trailKind`, and replaces `Run.trailTitle`/`trailKind` with
 * `Run.trailId`. Every step runs inside the single `version(5).upgrade()`
 * transaction so a failure rolls back the whole upgrade without deleting or
 * resetting the database.
 */
export async function migrateToV5(tx: Transaction): Promise<void> {
  const now = new Date().toISOString() as UtcDateTimeString;

  await tx.table('workspaces').add(createDefaultWorkspace(now));

  await tx
    .table('projects')
    .toCollection()
    .modify((project: LegacyProjectV4) => {
      project.workspaceId = DEFAULT_WORKSPACE_ID;
    });

  const legacyRuns: LegacyRunV4[] = await tx.table('runs').toArray();

  for (const run of legacyRuns) {
    if (run.trailTitle === undefined || run.trailKind === undefined) {
      throw new TypeError(
        `Legacy Run must contain trailTitle and trailKind: ${run.id}`,
      );
    }

    await tx.table('trails').add({
      id: `trail-${run.id}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      archivedAt: null,
      projectId: run.projectId,
      title: run.trailTitle,
      kind: run.trailKind,
    });
  }

  await tx
    .table('runs')
    .toCollection()
    .modify((run: LegacyRunV4) => {
      run.trailId = `trail-${run.id}`;
      delete run.trailTitle;
      delete run.trailKind;
    });
}
