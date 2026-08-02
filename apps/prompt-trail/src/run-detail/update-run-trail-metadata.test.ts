import { describe, expect, it, vi } from 'vitest';
import type { Run, UtcDateTimeString } from '../domain';
import { PromptTrailRepositoryError } from '../repository';
import { updateRunTrailMetadata } from './update-run-trail-metadata';

const input = {
  runId: 'run-1' as Run['id'],
  expectedUpdatedAt: '2026-08-01T00:00:00.000Z' as UtcDateTimeString,
  trailTitle: '  New title  ',
  trailKind: 'development',
};

describe('updateRunTrailMetadata', () => {
  it('validates, normalizes, and gives the repository a distinct timestamp', async () => {
    const update = vi.fn(async (value) => ({ ...value, id: value.runId }));
    const result = await updateRunTrailMetadata(
      { updateRunTrailMetadata: update } as never,
      input,
      () => input.expectedUpdatedAt,
    );
    expect(result.status).toBe('success');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ trailTitle: 'New title' }),
    );
    expect(update.mock.calls[0]?.[0].updatedAt).not.toBe(
      input.expectedUpdatedAt,
    );
  });

  it('does not access the repository for invalid metadata', async () => {
    const update = vi.fn();
    await expect(
      updateRunTrailMetadata({ updateRunTrailMetadata: update } as never, {
        ...input,
        trailTitle: '   ',
      }),
    ).resolves.toEqual({ status: 'invalid' });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['reference-not-found', 'not-found'],
    ['reference-unavailable', 'unavailable'],
    ['stale-write', 'stale'],
  ] as const)('maps %s to %s', async (code, status) => {
    const repository = {
      updateRunTrailMetadata: vi.fn(async () => {
        throw new PromptTrailRepositoryError(code);
      }),
    };
    await expect(
      updateRunTrailMetadata(repository as never, input),
    ).resolves.toEqual({ status });
  });
});
