import type { TrailKind } from '../../domain';

/** The persisted Run shape before trail metadata became mandatory. */
interface LegacyRunV1 {
  readonly promptSnapshot?: { readonly title?: unknown };
  trailTitle?: string;
  trailKind?: TrailKind;
}

export function migrateRunFromV1(run: LegacyRunV1): void {
  if (
    run.promptSnapshot === undefined ||
    typeof run.promptSnapshot.title !== 'string'
  ) {
    throw new TypeError('Legacy Run must contain a Prompt Snapshot title.');
  }

  run.trailTitle = run.promptSnapshot.title;
  run.trailKind = 'other';
}
