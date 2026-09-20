import { describe, expect, it, vi } from 'vitest';
import type { TrailId, TrailStepId, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { reorderTrailSteps } from './reorder-trail-steps';

const input = {
  trailId: 'trail-1' as TrailId,
  orderedStepIds: ['trail-step-2', 'trail-step-1'] as TrailStepId[],
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
};

function repo(overrides: Record<string, unknown> = {}) {
  return {
    reorderTrailSteps: vi.fn(async (value) => [value]),
    ...overrides,
  };
}

describe('reorderTrailSteps', () => {
  it('calls the repository with a generated updatedAt', async () => {
    const repository = repo();
    const now = () => '2026-08-01T01:00:00.000Z' as UtcDateTimeString;
    const result = await reorderTrailSteps(repository as never, input, {
      now,
    });
    expect(result.status).toBe('success');
    expect(repository.reorderTrailSteps).toHaveBeenCalledWith({
      trailId: input.trailId,
      orderedStepIds: input.orderedStepIds,
      expectedUpdatedAt: input.expectedUpdatedAt,
      updatedAt: now(),
    });
  });

  it('maps stale-write to stale', async () => {
    const repository = repo({
      reorderTrailSteps: vi.fn(async () => {
        throw new PromptTrailRepositoryError('stale-write');
      }),
    });
    await expect(
      reorderTrailSteps(repository as never, input),
    ).resolves.toEqual({ status: 'stale' });
  });

  it('maps other repository errors to failure', async () => {
    const repository = repo({
      reorderTrailSteps: vi.fn(async () => {
        throw new PromptTrailRepositoryError('reference-not-found');
      }),
    });
    await expect(
      reorderTrailSteps(repository as never, input),
    ).resolves.toEqual({ status: 'failure' });
  });

  it('rethrows non-repository errors', async () => {
    const repository = repo({
      reorderTrailSteps: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await expect(reorderTrailSteps(repository as never, input)).rejects.toThrow(
      'boom',
    );
  });
});
