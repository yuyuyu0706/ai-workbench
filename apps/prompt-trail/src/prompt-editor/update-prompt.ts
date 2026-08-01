import type { Prompt, PromptKind, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import type { PromptEditorValues } from './prompt-editor-validation';
import type { PromptEditorDependencies } from './create-prompt';

export async function updatePrompt(
  repository: PromptTrailRepository,
  prompt: Prompt,
  values: PromptEditorValues,
  dependencies: Pick<PromptEditorDependencies, 'now'> = {},
) {
  const updated: Prompt = {
    ...prompt,
    title: values.title.trim(),
    body: values.body,
    kind: values.kind as PromptKind,
    updatedAt:
      dependencies.now?.() ?? (new Date().toISOString() as UtcDateTimeString),
  };
  return repository.savePrompt(updated);
}
