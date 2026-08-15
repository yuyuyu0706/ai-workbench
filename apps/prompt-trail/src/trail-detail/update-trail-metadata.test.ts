import { describe, expect, it, vi } from 'vitest';
import type { Trail, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { updateRunTrailMetadata } from './update-trail-metadata';

const input = {
  trailId: 'trail-1' as Trail['id'],
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
  trailTitle: '  New title  ',
  trailKind: 'development',
};

describe('updateRunTrailMetadata', () => {
  it('validates, normalizes, and gives the repository a distinct timestamp', async () => {
    const update = vi.fn(async (value) => ({ ...value, id: value.trailId }));
    const result = await updateRunTrailMetadata(
      { updateTrailMetadata: update } as never,
      input,
      () => input.expectedUpdatedAt,
    );
    expect(result.status).toBe('success');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New title' }),
    );
    expect(update.mock.calls[0]?.[0].updatedAt).not.toBe(
      input.expectedUpdatedAt,
    );
  });

  it('does not access the repository for invalid metadata', async () => {
    const update = vi.fn();
    await expect(
      updateRunTrailMetadata({ updateTrailMetadata: update } as never, {
        ...input,
        trailTitle: '   ',
      }),
    ).resolves.toEqual({ status: 'invalid' });
    expect(update).not.toHaveBeenCalled();
  });

  it('advances one millisecond from expectedUpdatedAt when the clock is behind', async () => {
    const update = vi.fn(async (value) => ({ ...value, id: value.trailId }));
    await updateRunTrailMetadata(
      { updateTrailMetadata: update } as never,
      input,
      () => '2026-07-31T23:59:59.000Z' as UtcDateTimeString,
    );
    expect(update.mock.calls[0]?.[0].updatedAt).toBe(
      '2026-08-01T00:00:00.001Z',
    );
  });

  it.each([
    ['reference-not-found', 'not-found'],
    ['reference-unavailable', 'unavailable'],
    ['stale-write', 'stale'],
  ] as const)('maps %s to %s', async (code, status) => {
    const repository = {
      updateTrailMetadata: vi.fn(async () => {
        throw new PromptTrailRepositoryError(code);
      }),
    };
    await expect(
      updateRunTrailMetadata(repository as never, input),
    ).resolves.toEqual({ status });
  });
});
