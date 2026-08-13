import type { Run, Trail } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type ReusableRunState =
  | { readonly status: 'data'; readonly run: Run; readonly trail: Trail }
  | { readonly status: 'not-found' }
  | { readonly status: 'failure' };

/** Loads the immutable Prompt snapshot used as the starting point for a Trail. */
export async function loadReusableRun(
  repository: PromptTrailRepository,
  sourceRunId: string,
): Promise<ReusableRunState> {
  if (sourceRunId.trim().length === 0) return { status: 'not-found' };

  try {
    const run = await repository.getRun(sourceRunId as Run['id']);
    if (run === null || run.deletedAt !== null) return { status: 'not-found' };
    const trail = await repository.getTrail(run.trailId);
    if (trail === null) return { status: 'not-found' };
    return { status: 'data', run, trail };
  } catch {
    return { status: 'failure' };
  }
}
