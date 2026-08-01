import type { Prompt, PromptId } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type PromptEditorDataState =
  | { readonly status: 'data'; readonly prompt: Prompt }
  | { readonly status: 'not-found' | 'unavailable' | 'failure' };

export async function loadPromptEditorDataState(
  repository: PromptTrailRepository,
  promptId: PromptId,
): Promise<PromptEditorDataState> {
  try {
    const prompt = await repository.getPrompt(promptId);
    if (prompt === null) return { status: 'not-found' };
    if (prompt.status !== 'active' || prompt.deletedAt !== null)
      return { status: 'unavailable' };
    return { status: 'data', prompt };
  } catch {
    return { status: 'failure' };
  }
}
