import type { Transaction } from 'dexie';

/**
 * Upgrades schema v8 to v9.
 *
 * Adds `Run.messages` (conversation history sent to/received from the AI
 * Execution Gateway, see #316) to every existing Run record. Every Run
 * persisted before this schema version predates the field, so it is
 * backfilled with `[]` — the same "no history yet" value new Runs are
 * created with. No other Store or field is touched, and the whole backfill
 * runs inside the single `version(9).upgrade()` transaction so a failure
 * rolls back without deleting or resetting the database.
 */
export async function migrateToV9(tx: Transaction): Promise<void> {
  await tx
    .table('runs')
    .toCollection()
    .modify((run: { messages?: readonly unknown[] }) => {
      run.messages = [];
    });
}
