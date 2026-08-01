import { describe, expect, it, vi } from 'vitest';

import type { Prompt, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { loadPromptLibraryDataState } from './prompt-library-data-state';

const timestamp = '2026-08-01T00:00:00.000Z' as UtcDateTimeString;
const prompt: Prompt = {
  id: 'prompt-data-state' as Prompt['id'],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  scope: 'global',
  title: 'Data state Prompt',
  body: 'Prompt body',
  kind: 'other',
  status: 'active',
  tags: [],
};

describe('loadPromptLibraryDataState', () => {
  it('returns data when the repository has an active Prompt', async () => {
    const repository = createRepository([prompt]);

    await expect(loadPromptLibraryDataState(repository)).resolves.toEqual({
      status: 'data',
      data: {
        prompts: [
          {
            id: prompt.id,
            title: prompt.title,
            body: prompt.body,
            kind: prompt.kind,
            scope: prompt.scope,
            updatedAt: prompt.updatedAt,
          },
        ],
      },
    });
  });

  it('returns empty when the repository has no active Prompts', async () => {
    await expect(
      loadPromptLibraryDataState(createRepository([])),
    ).resolves.toEqual({ status: 'empty' });
  });

  it('returns failure with the repository error', async () => {
    const error = new Error('repository read failed');
    const repository = {
      listActivePrompts: vi.fn(async () => {
        throw error;
      }),
    } as unknown as PromptTrailRepository;

    await expect(loadPromptLibraryDataState(repository)).resolves.toEqual({
      status: 'failure',
      error,
    });
  });
});

function createRepository(prompts: readonly Prompt[]): PromptTrailRepository {
  return {
    listActivePrompts: vi.fn(async () => prompts),
  } as unknown as PromptTrailRepository;
}
