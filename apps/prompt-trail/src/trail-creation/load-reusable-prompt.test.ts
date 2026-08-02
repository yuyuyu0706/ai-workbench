import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_ID, type Prompt } from '../domain';
import type { PromptTrailRepository } from '../repository';
import { loadReusablePrompt } from './load-reusable-prompt';

const prompt = {
  id: 'prompt-1',
  deletedAt: null,
  status: 'active',
  scope: 'project',
  projectId: DEFAULT_PROJECT_ID,
} as Prompt;

describe('loadReusablePrompt', () => {
  it.each([
    [prompt, 'data'],
    [{ ...prompt, scope: 'global', projectId: undefined } as Prompt, 'data'],
    [null, 'not-found'],
    [
      { ...prompt, deletedAt: '2026-01-01T00:00:00.000Z' } as Prompt,
      'unavailable',
    ],
    [{ ...prompt, status: 'draft' } as Prompt, 'unavailable'],
    [{ ...prompt, projectId: 'other-project' } as Prompt, 'unavailable'],
  ])('maps repository value to %s', async (value, status) => {
    const repository = {
      getPrompt: vi.fn().mockResolvedValue(value),
    } as unknown as PromptTrailRepository;
    expect(await loadReusablePrompt(repository, 'prompt-1')).toMatchObject({
      status,
    });
  });

  it('does not query an empty ID and hides repository failures', async () => {
    const getPrompt = vi.fn().mockRejectedValue(new Error('private detail'));
    const repository = { getPrompt } as unknown as PromptTrailRepository;
    await expect(loadReusablePrompt(repository, ' ')).resolves.toEqual({
      status: 'not-found',
    });
    expect(getPrompt).not.toHaveBeenCalled();
    await expect(loadReusablePrompt(repository, 'prompt-1')).resolves.toEqual({
      status: 'failure',
    });
  });
});
