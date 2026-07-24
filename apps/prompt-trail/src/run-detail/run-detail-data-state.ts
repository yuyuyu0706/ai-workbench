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
  runId: string,
): Promise<RunDetailDataState> {
  try {
    const data = await loadRunDetailReadModel(repository, runId as never);
    return data === null ? { status: 'not-found' } : { status: 'data', data };
  } catch {
    return { status: 'failure' };
  }
}
