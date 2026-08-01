import { DEFAULT_PROJECT_ID, type Prompt, type PromptKind } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type PromptLibraryItem = {
  readonly id: Prompt['id'];
  readonly title: string;
  readonly body: string;
  readonly kind: PromptKind;
  readonly scope: Prompt['scope'];
  readonly updatedAt: Prompt['updatedAt'];
};

export type PromptLibraryReadModel = {
  readonly prompts: readonly PromptLibraryItem[];
};

export async function loadPromptLibraryReadModel(
  repository: PromptTrailRepository,
): Promise<PromptLibraryReadModel> {
  const prompts = await repository.listActivePrompts(DEFAULT_PROJECT_ID);

  return {
    prompts: prompts.map(toItem).sort(compareByUpdatedAtDesc),
  };
}

export function searchPromptLibraryItems(
  prompts: readonly PromptLibraryItem[],
  query: string,
): readonly PromptLibraryItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return prompts;

  return prompts.filter((prompt) =>
    `${prompt.title}\n${prompt.body}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

function toItem(prompt: Prompt): PromptLibraryItem {
  return {
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    kind: prompt.kind,
    scope: prompt.scope,
    updatedAt: prompt.updatedAt,
  };
}

function compareByUpdatedAtDesc(
  first: PromptLibraryItem,
  second: PromptLibraryItem,
): number {
  return (
    second.updatedAt.localeCompare(first.updatedAt) ||
    first.id.localeCompare(second.id)
  );
}
