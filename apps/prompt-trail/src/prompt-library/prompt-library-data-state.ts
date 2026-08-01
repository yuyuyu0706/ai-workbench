import type { PromptTrailRepository } from '../repository';
import {
  loadPromptLibraryReadModel,
  type PromptLibraryReadModel,
} from './prompt-library-read-query';

export type PromptLibraryDataState =
  | { readonly status: 'data'; readonly data: PromptLibraryReadModel }
  | { readonly status: 'empty' }
  | { readonly status: 'failure'; readonly error: unknown };

export async function loadPromptLibraryDataState(
  repository: PromptTrailRepository,
): Promise<PromptLibraryDataState> {
  try {
    const data = await loadPromptLibraryReadModel(repository);
    return data.prompts.length === 0
      ? { status: 'empty' }
      : { status: 'data', data };
  } catch (error: unknown) {
    return { status: 'failure', error };
  }
}
