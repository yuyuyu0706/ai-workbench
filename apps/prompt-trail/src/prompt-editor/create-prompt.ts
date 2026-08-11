import {
  createDefaultProject,
  DEFAULT_PROJECT_ID,
  type Prompt,
  type UtcDateTimeString,
} from '../domain';
import type { PromptTrailRepository } from '../repository';
import type { PromptEditorValues } from './prompt-editor-validation';

export interface PromptEditorDependencies {
  readonly createId?: () => Prompt['id'];
  readonly now?: () => UtcDateTimeString;
}

export async function createPrompt(
  repository: PromptTrailRepository,
  values: PromptEditorValues,
  dependencies: PromptEditorDependencies = {},
  variableValues: Record<string, string> = {},
) {
  const now =
    dependencies.now?.() ?? (new Date().toISOString() as UtcDateTimeString);
  const prompt: Prompt = {
    id:
      dependencies.createId?.() ??
      (`prompt-${crypto.randomUUID()}` as Prompt['id']),
    scope: 'project',
    projectId: DEFAULT_PROJECT_ID,
    title: values.title.trim(),
    body: values.body,
    status: 'active',
    tags: values.tags,
    variableValues,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  if ((await repository.getProject(DEFAULT_PROJECT_ID)) === null)
    await repository.saveProject(createDefaultProject(now));
  return repository.savePrompt(prompt);
}
