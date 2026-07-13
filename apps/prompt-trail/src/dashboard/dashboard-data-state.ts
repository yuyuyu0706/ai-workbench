import type { PromptTrailRepository } from '../repository';

import {
  loadDashboardReadModel,
  type DashboardReadModel,
  type DashboardReadOptions,
} from './dashboard-read-query';

export type DashboardDataState =
  | {
      readonly status: 'data';
      readonly data: DashboardReadModel;
    }
  | {
      readonly status: 'empty';
    }
  | {
      readonly status: 'failure';
      readonly error: unknown;
    };

export async function loadDashboardDataState(
  repository: PromptTrailRepository,
  options: DashboardReadOptions,
): Promise<DashboardDataState> {
  try {
    const data = await loadDashboardReadModel(repository, options);

    if (data.recentRuns.length === 0) {
      return { status: 'empty' };
    }

    return { status: 'data', data };
  } catch (error: unknown) {
    return { status: 'failure', error };
  }
}
