import type { PromptTrailRepository } from '../repository';

import {
  loadTrailListReadModel,
  type TrailListReadModel,
  type TrailListReadOptions,
} from './trail-list-read-query';

export type TrailListDataState =
  | {
      readonly status: 'data';
      readonly data: TrailListReadModel;
    }
  | {
      readonly status: 'empty';
    }
  | {
      readonly status: 'failure';
      readonly error: unknown;
    };

export async function loadTrailListDataState(
  repository: PromptTrailRepository,
  options?: TrailListReadOptions,
): Promise<TrailListDataState> {
  try {
    const data = await loadTrailListReadModel(repository, options);

    if (data.trails.length === 0) {
      return { status: 'empty' };
    }

    return { status: 'data', data };
  } catch (error: unknown) {
    return { status: 'failure', error };
  }
}
