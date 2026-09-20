import type {
  TrailId,
  TrailStep,
  TrailStepId,
  UtcDateTimeString,
} from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';

export interface ReorderTrailStepsInput {
  readonly trailId: TrailId;
  readonly orderedStepIds: readonly TrailStepId[];
  readonly expectedUpdatedAt: UtcDateTimeString;
}

export type ReorderTrailStepsResult =
  | { readonly status: 'success'; readonly trailSteps: readonly TrailStep[] }
  | { readonly status: 'stale' }
  | { readonly status: 'failure' };

export type ReorderTrailStepsDependencies = {
  readonly now?: () => UtcDateTimeString;
};

export async function reorderTrailSteps(
  repository: PromptTrailRepository,
  input: ReorderTrailStepsInput,
  dependencies: ReorderTrailStepsDependencies = {},
): Promise<ReorderTrailStepsResult> {
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);

  try {
    const trailSteps = await repository.reorderTrailSteps({
      trailId: input.trailId,
      orderedStepIds: input.orderedStepIds,
      expectedUpdatedAt: input.expectedUpdatedAt,
      updatedAt: now(),
    });
    return { status: 'success', trailSteps };
  } catch (error) {
    if (error instanceof PromptTrailRepositoryError) {
      if (error.code === 'stale-write') return { status: 'stale' };
      return { status: 'failure' };
    }
    throw error;
  }
}
