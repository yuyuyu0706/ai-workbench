import type { TrailId } from '../domain';
import type { PromptTrailRepository } from '../repository';
import {
  loadRunDetailReadModel,
  type RunDetailReadModel,
} from './run-detail-read-query';
export type RunDetailDataState =
  | { readonly status: 'data'; readonly data: RunDetailReadModel }
  | { readonly status: 'not-found' }
  | { readonly status: 'failure' };
export async function loadRunDetailDataState(
  repository: PromptTrailRepository,
  trailId: string,
): Promise<RunDetailDataState> {
  try {
    const trail = await repository.getTrail(trailId as TrailId);
    if (trail === null) return { status: 'not-found' };
    const runs = await repository.listRunsByTrail(trail.id);
    const run = runs[0];
    if (run === undefined) return { status: 'not-found' };
    const data = await loadRunDetailReadModel(repository, run.id);
    return data === null ? { status: 'not-found' } : { status: 'data', data };
  } catch {
    return { status: 'failure' };
  }
}
