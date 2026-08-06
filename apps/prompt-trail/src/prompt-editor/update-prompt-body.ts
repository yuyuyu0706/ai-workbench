import type { Prompt, PromptId, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { PromptTrailRepositoryError } from '../repository';
import { validatePromptBody } from './prompt-editor-validation';

export interface UpdatePromptBodyInput {
  readonly promptId: PromptId;
  readonly expectedUpdatedAt: UtcDateTimeString;
  readonly body: string;
}

export type UpdatePromptBodyResult =
  | { readonly status: 'success'; readonly prompt: Prompt }
  | { readonly status: 'invalid' }
  | { readonly status: 'not-found' | 'unavailable' | 'stale' };

export function defaultNow(): UtcDateTimeString {
  return new Date().toISOString() as UtcDateTimeString;
}

export function nextPromptBodyUpdatedAt(
  expectedUpdatedAt: UtcDateTimeString,
  current: UtcDateTimeString,
): UtcDateTimeString {
  if (current > expectedUpdatedAt) return current;
  return new Date(
    Date.parse(expectedUpdatedAt) + 1,
  ).toISOString() as UtcDateTimeString;
}

export async function updatePromptBody(
  repository: PromptTrailRepository,
  input: UpdatePromptBodyInput,
  now: () => UtcDateTimeString = defaultNow,
): Promise<UpdatePromptBodyResult> {
  if (validatePromptBody(input.body) !== undefined)
    return { status: 'invalid' };

  try {
    const prompt = await repository.updatePromptBody({
      promptId: input.promptId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      body: input.body,
      updatedAt: nextPromptBodyUpdatedAt(input.expectedUpdatedAt, now()),
    });
    return { status: 'success', prompt };
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
