import type { Transaction } from 'dexie';

/**
 * Upgrades schema v6 to v7.
 *
 * Adds `Run.output` (generated text from an AI Execution Gateway call, see
 * ADR 0009) to every existing Run record. Every Run persisted before this
 * schema version predates the field, so it is backfilled with `null` — the
 * same "not yet generated" value new Runs are created with. No other Store
 * or field is touched, and the whole backfill runs inside the single
 * `version(7).upgrade()` transaction so a failure rolls back without
 * deleting or resetting the database.
 */
export async function migrateToV7(tx: Transaction): Promise<void> {
  await tx
    .table('runs')
    .toCollection()
    .modify((run: { output?: string | null }) => {
      run.output = null;
    });
}
