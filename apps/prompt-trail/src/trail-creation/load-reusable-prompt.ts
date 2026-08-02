import { DEFAULT_PROJECT_ID, type Prompt } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type ReusablePromptState =
  | { readonly status: 'data'; readonly prompt: Prompt }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'stale' }
  | { readonly status: 'failure' };

export async function loadReusablePrompt(
  repository: PromptTrailRepository,
  promptId: string,
): Promise<ReusablePromptState> {
  if (promptId.trim().length === 0) return { status: 'not-found' };
  try {
    const prompt = await repository.getPrompt(promptId as Prompt['id']);
    if (prompt === null) return { status: 'not-found' };
    const availableScope =
      prompt.scope === 'global' ||
      (prompt.scope === 'project' && prompt.projectId === DEFAULT_PROJECT_ID);
    if (
      prompt.deletedAt !== null ||
      prompt.status !== 'active' ||
      !availableScope
    )
      return { status: 'unavailable' };
    return { status: 'data', prompt };
  } catch {
    return { status: 'failure' };
  }
}
