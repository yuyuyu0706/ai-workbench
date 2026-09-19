import type {
  PromptId,
  TrailStep,
  TrailStepId,
  TrailStepKind,
  UtcDateTimeString,
} from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import {
  normalizeTrailStepTitle,
  validateTrailStepMetadata,
} from '../trail-step-metadata';

export interface UpdateTrailStepInput {
  readonly trailStepId: TrailStepId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly title: string;
  readonly kind: TrailStepKind;
  readonly promptId: PromptId | null;
}

export type UpdateTrailStepResult =
  | { readonly status: 'success'; readonly trailStep: TrailStep }
  | { readonly status: 'stale' }
  | { readonly status: 'failure' };

export type UpdateTrailStepDependencies = {
  readonly now?: () => UtcDateTimeString;
};

export async function updateTrailStep(
  repository: PromptTrailRepository,
  input: UpdateTrailStepInput,
  dependencies: UpdateTrailStepDependencies = {},
): Promise<UpdateTrailStepResult> {
  const errors = validateTrailStepMetadata(input);
  if (errors.length > 0) return { status: 'failure' };

  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);

  try {
    const current = await repository.getTrailStep(input.trailStepId);
    if (current === null) return { status: 'failure' };
    const trailStep = await repository.updateTrailStep({
      trailStepId: input.trailStepId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      title: normalizeTrailStepTitle(input.title),
      kind: input.kind,
      promptId: input.promptId,
      note: current.note,
      updatedAt: now(),
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
