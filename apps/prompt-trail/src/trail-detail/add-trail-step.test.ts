import { describe, expect, it, vi } from 'vitest';
import type { TrailId, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { addTrailStep } from './add-trail-step';

const input = {
  trailId: 'trail-1' as TrailId,
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
  title: '  New Step  ',
  kind: 'prompt' as const,
  promptId: 'prompt-1' as never,
};

describe('addTrailStep', () => {
  it('normalizes the title, generates an id via createId, and returns the saved Step', async () => {
    const add = vi.fn(async (value) => value.trailStep);
    const result = await addTrailStep(
      { addTrailStep: add } as never,
      input,
      {
        createId: (kind) => `${kind}-fixed`,
        now: () => input.expectedUpdatedAt,
      },
    );
    expect(result).toEqual({
      status: 'success',
      trailStep: expect.objectContaining({
        id: 'trail-step-fixed',
        title: 'New Step',
      }),
    });
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        trailStep: expect.objectContaining({
          id: 'trail-step-fixed',
          title: 'New Step',
        }),
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );
    // order is not passed; the repository auto-assigns it.
    expect(add.mock.calls[0]?.[0].trailStep).not.toHaveProperty('order');
  });

  it('does not access the repository for invalid metadata', async () => {
    const add = vi.fn();
    await expect(
      addTrailStep({ addTrailStep: add } as never, {
        ...input,
        title: '   ',
      }),
    ).resolves.toEqual({ status: 'failure' });
    expect(add).not.toHaveBeenCalled();
  });

  it('maps stale-write to stale', async () => {
    const add = vi.fn(async () => {
      throw new PromptTrailRepositoryError('stale-write');
    });
    await expect(
      addTrailStep({ addTrailStep: add } as never, input),
    ).resolves.toEqual({ status: 'stale' });
  });

  it('maps other repository errors to failure', async () => {
    const add = vi.fn(async () => {
      throw new PromptTrailRepositoryError('reference-not-found');
    });
    await expect(
      addTrailStep({ addTrailStep: add } as never, input),
    ).resolves.toEqual({ status: 'failure' });
  });

  it('generates an id with crypto.randomUUID when createId is not injected', async () => {
    const add = vi.fn(async (value) => value.trailStep);
    const result = await addTrailStep({ addTrailStep: add } as never, input);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.trailStep.id).toMatch(/^trail-step-/);
    }
  });
});
