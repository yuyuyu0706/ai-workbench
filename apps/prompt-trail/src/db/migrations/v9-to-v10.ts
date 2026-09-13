import type { Transaction } from 'dexie';

/** The persisted Run shape before TrailStep became an independent Store. */
interface LegacyRunV9 {
  readonly id: string;
  readonly trailId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly promptSnapshot: {
    readonly promptId: string;
    readonly title: string;
  };
  trailStepId?: string;
}

/**
 * Upgrades schema v9 to v10.
 *
 * Creates one TrailStep per existing Run (see ADR 0011) and points
 * `Run.trailStepId` at it. Runs are grouped by `trailId` and, within each
 * group, ordered by `createdAt` ascending so `order` is assigned 1..N per
 * Trail rather than globally — a Trail may already have more than one Run
 * from the v4-to-v5 backfill. Every step runs inside the single
 * `version(10).upgrade()` transaction so a failure rolls back the whole
 * upgrade without deleting or resetting the database.
 */
export async function migrateToV10(tx: Transaction): Promise<void> {
  const runs: LegacyRunV9[] = await tx.table('runs').toArray();

  const runsByTrailId = new Map<string, LegacyRunV9[]>();
  for (const run of runs) {
    const group = runsByTrailId.get(run.trailId);
    if (group === undefined) {
      runsByTrailId.set(run.trailId, [run]);
    } else {
      group.push(run);
    }
  }

  const trailStepIdByRunId = new Map<string, string>();

  for (const group of runsByTrailId.values()) {
    const orderedGroup = [...group].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    for (const [index, run] of orderedGroup.entries()) {
      const trailStepId = `trail-step-${run.id}`;
      trailStepIdByRunId.set(run.id, trailStepId);

      await tx.table('trailSteps').add({
        id: trailStepId,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        deletedAt: null,
        trailId: run.trailId,
        order: index + 1,
        kind: 'prompt',
        title: run.promptSnapshot.title,
        promptId: run.promptSnapshot.promptId,
        note: null,
      });
    }
  }

  await tx
    .table('runs')
    .toCollection()
    .modify((run: LegacyRunV9) => {
      const trailStepId = trailStepIdByRunId.get(run.id);
      if (trailStepId === undefined) {
        throw new TypeError(`No backfilled TrailStep found for Run: ${run.id}`);
      }
      run.trailStepId = trailStepId;
    });
}
