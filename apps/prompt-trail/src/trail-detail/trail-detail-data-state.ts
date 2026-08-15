import type { TrailId } from '../domain';
import type { PromptTrailRepository } from '../repository';
import {
  loadTrailDetailReadModel,
  type TrailDetailReadModel,
} from './trail-detail-read-query';
export type TrailDetailDataState =
  | { readonly status: 'data'; readonly data: TrailDetailReadModel }
  | { readonly status: 'not-found' }
  | { readonly status: 'failure' };
export async function loadTrailDetailDataState(
  repository: PromptTrailRepository,
  trailId: string,
): Promise<TrailDetailDataState> {
  try {
    const data = await loadTrailDetailReadModel(repository, trailId as TrailId);
    return data === null ? { status: 'not-found' } : { status: 'data', data };
  } catch {
    return { status: 'failure' };
  }
}
