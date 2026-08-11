import { DEFAULT_PROJECT_ID, type Prompt } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type PromptLibraryItem = {
  readonly id: Prompt['id'];
  readonly title: string;
  readonly body: string;
  readonly scope: Prompt['scope'];
  readonly updatedAt: Prompt['updatedAt'];
  readonly variableValues: Prompt['variableValues'];
  readonly tags: Prompt['tags'];
};

export type PromptLibraryReadModel = {
  readonly prompts: readonly PromptLibraryItem[];
};

export type PromptSortMode = 'updated-desc' | 'name-asc' | 'name-desc';

export function sortPromptLibraryItems(
  prompts: readonly PromptLibraryItem[],
  mode: PromptSortMode,
): readonly PromptLibraryItem[] {
  return [...prompts].sort((first, second) => {
    if (mode === 'updated-desc') return compareByUpdatedAtDesc(first, second);
    const name = first.title.localeCompare(second.title, 'ja', {
      numeric: true,
      sensitivity: 'base',
    });
    return (
      (mode === 'name-desc' ? -name : name) ||
      compareByUpdatedAtDesc(first, second)
    );
  });
}

export async function loadPromptLibraryReadModel(
  repository: PromptTrailRepository,
): Promise<PromptLibraryReadModel> {
  const prompts = await repository.listActivePrompts(DEFAULT_PROJECT_ID);

  return {
    prompts: sortPromptLibraryItems(prompts.map(toItem), 'updated-desc'),
  };
}

export function searchPromptLibraryItems(
  prompts: readonly PromptLibraryItem[],
  query: string,
): readonly PromptLibraryItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return prompts;

  return prompts.filter((prompt) =>
    `${prompt.title}\n${prompt.body}\n${prompt.tags.join('\n')}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export type PromptTagFilter = 'all' | string;

export function filterPromptLibraryItemsByTag(
  prompts: readonly PromptLibraryItem[],
  tag: PromptTagFilter,
): readonly PromptLibraryItem[] {
  return tag === 'all'
    ? prompts
    : prompts.filter((prompt) => prompt.tags.includes(tag));
}

/**
 * Returns the deduplicated tags used across the given prompts, sorted by
 * usage frequency (most-used first) and then alphabetically (locale 'ja')
 * for ties. Used to populate the Tag Filter dropdown options.
 */
export function collectUsedTags(
  prompts: readonly PromptLibraryItem[],
): readonly string[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    for (const tag of prompt.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.keys()].sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b, 'ja', { numeric: true, sensitivity: 'base' });
  });
}

function toItem(prompt: Prompt): PromptLibraryItem {
  return {
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    scope: prompt.scope,
    updatedAt: prompt.updatedAt,
    variableValues: prompt.variableValues,
    tags: prompt.tags,
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
