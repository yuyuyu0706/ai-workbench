import type { TrailId, TrailStep, TrailStepId, UtcDateTimeString } from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';

export interface DeleteTrailStepInput {
  readonly trailId: TrailId;
  readonly trailStepId: TrailStepId;
  readonly expectedUpdatedAt: UtcDateTimeString;
}

export type DeleteTrailStepResult =
  | { readonly status: 'success'; readonly trailStep: TrailStep }
  | { readonly status: 'stale' }
  | { readonly status: 'failure' };

export type DeleteTrailStepDependencies = {
  readonly now?: () => UtcDateTimeString;
};

export async function deleteTrailStep(
  repository: PromptTrailRepository,
  input: DeleteTrailStepInput,
  dependencies: DeleteTrailStepDependencies = {},
): Promise<DeleteTrailStepResult> {
  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const deletedAt = now();

  try {
    const trailStep = await repository.softDeleteTrailStep({
      trailId: input.trailId,
      trailStepId: input.trailStepId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      deletedAt,
      updatedAt: deletedAt,
    });
    return { status: 'success', trailStep };
  } catch (error) {
    if (error instanceof PromptTrailRepositoryError) {
      if (error.code === 'stale-write') return { status: 'stale' };
      return { status: 'failure' };
    }
    throw error;
  }
}
