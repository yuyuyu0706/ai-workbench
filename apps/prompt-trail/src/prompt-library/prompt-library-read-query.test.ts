import { describe, expect, it, vi } from 'vitest';

import type { Prompt, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import {
  collectUsedTags,
  filterPromptLibraryItemsByTag,
  loadPromptLibraryReadModel,
  searchPromptLibraryItems,
  sortPromptLibraryItems,
} from './prompt-library-read-query';

const utc = (value: string) => value as UtcDateTimeString;
const prompt = (
  id: string,
  title: string,
  body: string,
  updatedAt: string,
  tags: readonly string[] = [],
): Prompt => ({
  id: id as Prompt['id'],
  createdAt: utc(updatedAt),
  updatedAt: utc(updatedAt),
  deletedAt: null,
  scope: 'global',
  title,
  body,
  status: 'active',
  tags,
  variableValues: {},
});

describe('Prompt Library read query', () => {
  it('requests the default-project scope and establishes stable newest-first order', async () => {
    const listActivePrompts = vi
      .fn()
      .mockResolvedValue([
        prompt('b', 'B', 'body', '2026-08-01T00:00:00.000Z'),
        prompt('a', 'A', 'body', '2026-08-01T00:00:00.000Z'),
        prompt('new', 'New', 'body', '2026-08-02T00:00:00.000Z'),
      ]);
    const model = await loadPromptLibraryReadModel({
      listActivePrompts,
    } as unknown as PromptTrailRepository);
    expect(listActivePrompts).toHaveBeenCalledWith(
      'prompt-trail-default-project',
    );
    expect(model.prompts.map(({ id }) => id)).toEqual(['new', 'a', 'b']);
  });

  it('searches title and full body with trimming, case folding, and Japanese partial matching', () => {
    const items = [
      prompt(
        'one',
        'CODEX Request',
        '日本語の本文です',
        '2026-08-01T00:00:00.000Z',
      ),
    ];
    expect(searchPromptLibraryItems(items, '  codex ')).toHaveLength(1);
    expect(searchPromptLibraryItems(items, '本文')).toHaveLength(1);
    expect(searchPromptLibraryItems(items, '   ')).toBe(items);
    expect(searchPromptLibraryItems(items, 'missing')).toEqual([]);
  });

  it('matches tag names when searching keywords', () => {
    const items = [
      prompt('one', 'Alpha', 'body', '2026-08-01T00:00:00.000Z', [
        'チャット相談',
        'note',
      ]),
      prompt('two', 'Beta', 'body', '2026-08-01T00:00:00.000Z', []),
    ];
    expect(
      searchPromptLibraryItems(items, 'チャット').map((p) => p.id),
    ).toEqual(['one']);
    expect(searchPromptLibraryItems(items, '  NOTE ').map((p) => p.id)).toEqual(
      ['one'],
    );
    expect(searchPromptLibraryItems(items, 'missing-tag')).toEqual([]);
  });

  it('filters items by tag, with "all" as the no-filter value', () => {
    const items = [
      prompt('one', 'Alpha', 'body', '2026-08-01T00:00:00.000Z', ['a', 'b']),
      prompt('two', 'Beta', 'body', '2026-08-01T00:00:00.000Z', ['b']),
      prompt('three', 'Gamma', 'body', '2026-08-01T00:00:00.000Z', []),
    ];
    expect(filterPromptLibraryItemsByTag(items, 'all')).toBe(items);
    expect(filterPromptLibraryItemsByTag(items, 'a').map((p) => p.id)).toEqual([
      'one',
    ]);
    expect(filterPromptLibraryItemsByTag(items, 'b').map((p) => p.id)).toEqual([
      'one',
      'two',
    ]);
    expect(filterPromptLibraryItemsByTag(items, 'missing')).toEqual([]);
  });

  it('collects used tags ordered by frequency then alphabetically', () => {
    const items = [
      prompt('one', 'Alpha', 'body', '2026-08-01T00:00:00.000Z', [
        'z-tag',
        'shared',
      ]),
      prompt('two', 'Beta', 'body', '2026-08-01T00:00:00.000Z', [
        'shared',
        'a-tag',
      ]),
      prompt('three', 'Gamma', 'body', '2026-08-01T00:00:00.000Z', []),
    ];
    expect(collectUsedTags(items)).toEqual(['shared', 'a-tag', 'z-tag']);
    expect(collectUsedTags([])).toEqual([]);
  });

  it('sorts names naturally without mutation and retains deterministic tie-breakers', () => {
    const items = [
      prompt('ten', 'Prompt 10', '', '2026-08-01T00:00:00.000Z'),
      prompt('two', 'prompt 2', '', '2026-08-01T00:00:00.000Z'),
      prompt('old', '同名', '', '2026-07-01T00:00:00.000Z'),
      prompt('b', '同名', '', '2026-08-01T00:00:00.000Z'),
      prompt('a', '同名', '', '2026-08-01T00:00:00.000Z'),
      prompt('ja', 'あいう', '', '2026-06-01T00:00:00.000Z'),
    ];
    const original = [...items];
    expect(
      sortPromptLibraryItems(items, 'name-asc').map(({ id }) => id),
    ).toEqual(['two', 'ten', 'ja', 'a', 'b', 'old']);
    expect(
      sortPromptLibraryItems(items, 'name-desc').map(({ id }) => id),
    ).toEqual(['a', 'b', 'old', 'ja', 'ten', 'two']);
    expect(
      sortPromptLibraryItems(items, 'updated-desc').map(({ id }) => id),
    ).toEqual(['a', 'b', 'ten', 'two', 'old', 'ja']);
    expect(items).toEqual(original);
  });
});
