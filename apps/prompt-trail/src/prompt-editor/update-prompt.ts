import type { Prompt, PromptId, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import type { PromptEditorValues } from './prompt-editor-validation';
import type { PromptEditorDependencies } from './create-prompt';

export class PromptUpdateTargetError extends Error {
  constructor(readonly status: 'not-found' | 'unavailable') {
    super(`Prompt update target is ${status}.`);
    this.name = 'PromptUpdateTargetError';
  }
}

export async function updatePrompt(
  repository: PromptTrailRepository,
  promptId: PromptId,
  values: PromptEditorValues,
  dependencies: Pick<PromptEditorDependencies, 'now'> = {},
  variableValues: Record<string, string> = {},
) {
  const prompt = await repository.getPrompt(promptId);
  if (prompt === null) throw new PromptUpdateTargetError('not-found');
  if (prompt.status !== 'active' || prompt.deletedAt !== null)
    throw new PromptUpdateTargetError('unavailable');

  const updated: Prompt = {
    ...prompt,
    title: values.title.trim(),
    body: values.body,
    tags: values.tags,
    variableValues,
    updatedAt:
      dependencies.now?.() ?? (new Date().toISOString() as UtcDateTimeString),
  };
  return repository.savePrompt(updated);
}
