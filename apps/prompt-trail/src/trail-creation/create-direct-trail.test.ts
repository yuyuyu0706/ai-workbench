/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import type { PromptTrailRepository } from '../repository';
import { createDirectTrail, createPromptTitle } from './create-direct-trail';
describe('createDirectTrail', () => {
  it('trims the body, creates a truncated title, and saves one direct bundle with injected values', async () => {
    const createDirectRunBundle = vi.fn(async (bundle: any) => bundle);
    const repository = {
      createDirectRunBundle,
    } as unknown as PromptTrailRepository;
    const run = await createDirectTrail(
      repository,
      { promptBody: `\n  ${'a'.repeat(100)}  \n body ` },
      {
        createId: (kind) => `${kind}-fixed`,
        now: () => '2026-01-01T00:00:00.000Z' as never,
      },
    );
    expect(createDirectRunBundle).toHaveBeenCalledOnce();
    expect(run.recipeId).toBeNull();
    const bundle = createDirectRunBundle.mock.calls[0][0];
    expect(bundle.prompt.body).toBe(`${'a'.repeat(100)}  \n body`);
    expect(bundle.prompt.title).toBe(`${'a'.repeat(79)}…`);
    expect(bundle.run.promptSnapshot).toMatchObject({
      promptId: 'prompt-fixed',
      body: bundle.prompt.body,
    });
  });
  it('normalizes the first non-empty title and propagates repository errors', async () => {
    expect(createPromptTitle('\n a   b \n c')).toBe('a b');
    const repository = {
      createDirectRunBundle: vi.fn(async () => {
        throw new Error('failed');
      }),
    } as unknown as PromptTrailRepository;
    await expect(
      createDirectTrail(repository, { promptBody: 'text' }),
    ).rejects.toThrow('failed');
  });
});
