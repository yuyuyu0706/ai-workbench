import type {
  PromptId,
  TrailId,
  TrailStep,
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

export interface AddTrailStepInput {
  readonly trailId: TrailId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly title: string;
  readonly kind: TrailStepKind;
  readonly promptId: PromptId | null;
}

export type AddTrailStepResult =
  | { readonly status: 'success'; readonly trailStep: TrailStep }
  | { readonly status: 'stale' }
  | { readonly status: 'failure' };

export type AddTrailStepDependencies = {
  readonly createId?: (kind: 'trail-step') => string;
  readonly now?: () => UtcDateTimeString;
};

export async function addTrailStep(
  repository: PromptTrailRepository,
  input: AddTrailStepInput,
  dependencies: AddTrailStepDependencies = {},
): Promise<AddTrailStepResult> {
  const errors = validateTrailStepMetadata(input);
  if (errors.length > 0) return { status: 'failure' };

  const now =
    dependencies.now ?? (() => new Date().toISOString() as UtcDateTimeString);
  const createId =
    dependencies.createId ?? ((kind) => `${kind}-${crypto.randomUUID()}`);
  const createdAt = now();

  try {
    const trailStep = await repository.addTrailStep({
      trailStep: {
        id: createId('trail-step') as TrailStep['id'],
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        trailId: input.trailId,
        kind: input.kind,
        title: normalizeTrailStepTitle(input.title),
        promptId: input.promptId,
        note: null,
      },
      expectedUpdatedAt: input.expectedUpdatedAt,
      updatedAt: createdAt,
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
