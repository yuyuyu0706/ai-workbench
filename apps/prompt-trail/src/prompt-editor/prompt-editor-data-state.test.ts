import { describe, expect, it, vi } from 'vitest';
import type { Prompt } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { loadPromptEditorDataState } from './prompt-editor-data-state';

const active = { id: 'prompt-1', status: 'active', deletedAt: null } as Prompt;

describe('loadPromptEditorDataState', () => {
  it.each([
    [null, 'not-found'],
    [{ ...active, status: 'draft' }, 'unavailable'],
    [{ ...active, deletedAt: '2026-08-01T00:00:00.000Z' }, 'unavailable'],
    [active, 'data'],
  ] as const)('maps repository data to %s', async (prompt, status) => {
    const repository = {
      getPrompt: vi.fn(async () => prompt),
    } as unknown as PromptTrailRepository;
    expect(
      (await loadPromptEditorDataState(repository, active.id)).status,
    ).toBe(status);
  });

  it('hides repository failures', async () => {
    const repository = {
      getPrompt: vi.fn(async () => {
        throw new Error('secret');
      }),
    } as unknown as PromptTrailRepository;
    expect(await loadPromptEditorDataState(repository, active.id)).toEqual({
      status: 'failure',
    });
  });
});
