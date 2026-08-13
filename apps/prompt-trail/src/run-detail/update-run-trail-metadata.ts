import type { Trail, TrailId, UtcDateTimeString } from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import {
  isTrailKind,
  normalizeTrailTitle,
  validateTrailMetadata,
} from '../trail-metadata';

export interface UpdateRunTrailMetadataInput {
  readonly trailId: TrailId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly trailTitle: string;
  readonly trailKind: unknown;
}

export type UpdateRunTrailMetadataResult =
  | { readonly status: 'success'; readonly trail: Trail }
  | { readonly status: 'invalid' }
  | { readonly status: 'not-found' | 'unavailable' | 'stale' };

export async function updateRunTrailMetadata(
  repository: PromptTrailRepository,
  input: UpdateRunTrailMetadataInput,
  now: () => UtcDateTimeString = () =>
    new Date().toISOString() as UtcDateTimeString,
): Promise<UpdateRunTrailMetadataResult> {
  if (
    validateTrailMetadata(input).length > 0 ||
    !isTrailKind(input.trailKind)
  ) {
    return { status: 'invalid' };
  }
  let updatedAt = now();
  if (
    new Date(updatedAt).getTime() <= new Date(input.expectedUpdatedAt).getTime()
  ) {
    updatedAt = new Date(
      new Date(input.expectedUpdatedAt).getTime() + 1,
    ).toISOString() as UtcDateTimeString;
  }
  try {
    const trail = await repository.updateTrailMetadata({
      trailId: input.trailId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      title: normalizeTrailTitle(input.trailTitle),
      kind: input.trailKind,
      updatedAt,
    });
    return { status: 'success', trail };
  } catch (error) {
    if (error instanceof PromptTrailRepositoryError) {
      if (error.code === 'reference-not-found') return { status: 'not-found' };
      if (error.code === 'reference-unavailable')
        return { status: 'unavailable' };
      if (error.code === 'stale-write') return { status: 'stale' };
    }
    throw error;
  }
}
