import { describe, expect, it, vi } from 'vitest';
import type { TrailId, TrailStepId, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { deleteTrailStep } from './delete-trail-step';

const input = {
  trailId: 'trail-1' as TrailId,
  trailStepId: 'trail-step-1' as TrailStepId,
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
};

function repo(overrides: Record<string, unknown> = {}) {
  return {
    softDeleteTrailStep: vi.fn(async (value) => ({ ...value })),
    ...overrides,
  };
}

describe('deleteTrailStep', () => {
  it('calls the repository with generated deletedAt/updatedAt', async () => {
    const repository = repo();
    const now = () => '2026-08-01T01:00:00.000Z' as UtcDateTimeString;
    const result = await deleteTrailStep(repository as never, input, { now });
    expect(result.status).toBe('success');
    expect(repository.softDeleteTrailStep).toHaveBeenCalledWith({
      trailId: input.trailId,
      trailStepId: input.trailStepId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      deletedAt: now(),
      updatedAt: now(),
    });
  });

  it('maps stale-write to stale', async () => {
    const repository = repo({
      softDeleteTrailStep: vi.fn(async () => {
        throw new PromptTrailRepositoryError('stale-write');
      }),
    });
    await expect(
      deleteTrailStep(repository as never, input),
    ).resolves.toEqual({ status: 'stale' });
  });

  it('maps reference-unavailable (and other errors) to failure', async () => {
    const repository = repo({
      softDeleteTrailStep: vi.fn(async () => {
        throw new PromptTrailRepositoryError('reference-unavailable');
      }),
    });
    await expect(
      deleteTrailStep(repository as never, input),
    ).resolves.toEqual({ status: 'failure' });
  });

  it('rethrows non-repository errors', async () => {
    const repository = repo({
      softDeleteTrailStep: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await expect(deleteTrailStep(repository as never, input)).rejects.toThrow(
      'boom',
    );
  });
});
