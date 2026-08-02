import { describe, expect, it, vi } from 'vitest';
import type { Prompt } from '../domain';
import {
  PromptTrailRepositoryError,
  type PromptTrailRepository,
} from '../repository';
import { createTrailFromPrompt } from './create-trail-from-prompt';

const sourcePrompt = {
  id: 'prompt-1',
  title: 'Prompt title',
  body: 'Body',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Pick<Prompt, 'id' | 'title' | 'body' | 'updatedAt'>;

describe('createTrailFromPrompt', () => {
  it('creates only a Run with normalized metadata and frozen source contents', async () => {
    const createDirectRunFromPrompt = vi.fn().mockResolvedValue({});
    const repository = {
      createDirectRunFromPrompt,
    } as unknown as PromptTrailRepository;
    const result = await createTrailFromPrompt(
      repository,
      { sourcePrompt, trailTitle: '  Trail  ', trailKind: 'review' },
      { createId: () => 'run-1', now: () => sourcePrompt.updatedAt },
    );
    expect(result).toMatchObject({
      status: 'created',
      run: {
        id: 'run-1',
        trailTitle: 'Trail',
        trailKind: 'review',
        promptSnapshot: {
          promptId: 'prompt-1',
          title: 'Prompt title',
          body: 'Body',
        },
        finalPrompt: 'Body',
        recipeId: null,
        contextSnapshots: [],
        inputValues: {},
      },
    });
    expect(createDirectRunFromPrompt).toHaveBeenCalledOnce();
  });

  it('does not write invalid metadata and maps known repository errors', async () => {
    const createDirectRunFromPrompt = vi.fn();
    const repository = {
      createDirectRunFromPrompt,
    } as unknown as PromptTrailRepository;
    await expect(
      createTrailFromPrompt(repository, {
        sourcePrompt,
        trailTitle: ' ',
        trailKind: 'other',
      }),
    ).resolves.toMatchObject({ status: 'invalid' });
    expect(createDirectRunFromPrompt).not.toHaveBeenCalled();
    for (const [code, status] of [
      ['reference-not-found', 'not-found'],
      ['reference-unavailable', 'unavailable'],
      ['stale-write', 'stale'],
    ] as const) {
      createDirectRunFromPrompt.mockRejectedValueOnce(
        new PromptTrailRepositoryError(code),
      );
      await expect(
        createTrailFromPrompt(repository, {
          sourcePrompt,
          trailTitle: 'Trail',
          trailKind: 'other',
        }),
      ).resolves.toEqual({ status });
    }
  });
});
