import type { Run } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type ReusableRunState =
  | { readonly status: 'data'; readonly run: Run }
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
    return run === null ? { status: 'not-found' } : { status: 'data', run };
  } catch {
    return { status: 'failure' };
  }
}
