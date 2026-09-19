import { describe, expect, it, vi } from 'vitest';
import type { TrailStepId, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { updateTrailStep } from './update-trail-step';

const currentStep = {
  id: 'trail-step-1' as TrailStepId,
  trailId: 'trail-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  order: 1,
  kind: 'prompt',
  title: 'Old title',
  promptId: 'prompt-1',
  note: 'kept as-is',
};

const input = {
  trailStepId: 'trail-step-1' as TrailStepId,
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
  title: '  New title  ',
  kind: 'prompt' as const,
  promptId: 'prompt-2' as never,
};

function repo(overrides: Record<string, unknown> = {}) {
  return {
    getTrailStep: vi.fn(async () => currentStep),
    updateTrailStep: vi.fn(async (value) => ({ ...currentStep, ...value })),
    ...overrides,
  };
}

describe('updateTrailStep', () => {
  it('normalizes the title, preserves note, and returns the saved Step', async () => {
    const repository = repo();
    const result = await updateTrailStep(repository as never, input, {
      now: () => input.expectedUpdatedAt,
    });
    expect(result.status).toBe('success');
    expect(repository.updateTrailStep).toHaveBeenCalledWith(
      expect.objectContaining({
        trailStepId: input.trailStepId,
        title: 'New title',
        note: 'kept as-is',
      }),
    );
    // order is not passed; the repository does not change it.
    expect(repository.updateTrailStep.mock.calls[0]?.[0]).not.toHaveProperty(
      'order',
    );
  });

  it('does not access the repository for invalid metadata', async () => {
    const repository = repo();
    await expect(
      updateTrailStep(repository as never, { ...input, title: '   ' }),
    ).resolves.toEqual({ status: 'failure' });
    expect(repository.updateTrailStep).not.toHaveBeenCalled();
    expect(repository.getTrailStep).not.toHaveBeenCalled();
  });

  it('maps stale-write to stale', async () => {
    const repository = repo({
      updateTrailStep: vi.fn(async () => {
        throw new PromptTrailRepositoryError('stale-write');
      }),
    });
    await expect(updateTrailStep(repository as never, input)).resolves.toEqual({
      status: 'stale',
    });
  });

  it('maps other repository errors to failure', async () => {
    const repository = repo({
      updateTrailStep: vi.fn(async () => {
        throw new PromptTrailRepositoryError('reference-not-found');
      }),
    });
    await expect(updateTrailStep(repository as never, input)).resolves.toEqual({
      status: 'failure',
    });
  });

  it('returns failure when the Step no longer exists', async () => {
    const repository = repo({ getTrailStep: vi.fn(async () => null) });
    await expect(updateTrailStep(repository as never, input)).resolves.toEqual({
      status: 'failure',
    });
  });
});
