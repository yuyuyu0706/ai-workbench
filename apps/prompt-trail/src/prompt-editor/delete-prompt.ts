import type { PromptId, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';

export class PromptDeleteTargetError extends Error {
  constructor(readonly status: 'not-found' | 'unavailable') {
    super(`Prompt delete target is ${status}.`);
    this.name = 'PromptDeleteTargetError';
  }
}

export async function deletePrompt(
  repository: PromptTrailRepository,
  promptId: PromptId,
  dependencies: { readonly now?: () => UtcDateTimeString } = {},
) {
  const prompt = await repository.getPrompt(promptId);
  if (prompt === null) throw new PromptDeleteTargetError('not-found');
  if (prompt.status !== 'active' || prompt.deletedAt !== null)
    throw new PromptDeleteTargetError('unavailable');

  const deletedAt =
    dependencies.now?.() ?? (new Date().toISOString() as UtcDateTimeString);
  return repository.softDeletePrompt(promptId, deletedAt);
}
