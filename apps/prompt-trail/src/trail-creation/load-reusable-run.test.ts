import { describe, expect, it, vi } from 'vitest';
import type { PromptTrailRepository } from '../repository';
import { loadReusableRun } from './load-reusable-run';

describe('loadReusableRun', () => {
  it('returns the Run whose immutable Prompt snapshot will be reused', async () => {
    const run = { id: 'run-source', promptSnapshot: { body: 'snapshot' } };
    const repository = {
      getRun: vi.fn(async () => run),
    } as unknown as PromptTrailRepository;

    await expect(loadReusableRun(repository, 'run-source')).resolves.toEqual({
      status: 'data',
      run,
    });
  });

  it('distinguishes missing Runs from repository failures', async () => {
    const missing = {
      getRun: vi.fn(async () => null),
    } as unknown as PromptTrailRepository;
    const failing = {
      getRun: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    } as unknown as PromptTrailRepository;

    await expect(loadReusableRun(missing, 'missing')).resolves.toEqual({
      status: 'not-found',
    });
    await expect(loadReusableRun(failing, 'source')).resolves.toEqual({
      status: 'failure',
    });
    await expect(loadReusableRun(missing, '   ')).resolves.toEqual({
      status: 'not-found',
    });
  });
});
