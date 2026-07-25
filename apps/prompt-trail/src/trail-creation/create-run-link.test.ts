import { describe, expect, it } from 'vitest';
import type { Link, RunId, UtcDateTimeString } from '../domain';
import { createRunLink } from './create-run-link';

describe('createRunLink', () => {
  it('normalizes a required title and creates a Link with a null role', () => {
    const link = createRunLink(
      {
        runId: 'run-1' as RunId,
        title: '  Design document  ',
        url: 'https://example.com/design',
        type: 'document',
      },
      {
        createId: () => 'link-1' as Link['id'],
        now: () => '2026-07-25T00:00:00.000Z' as UtcDateTimeString,
      },
    );

    expect(link).toMatchObject({
      id: 'link-1',
      runId: 'run-1',
      title: 'Design document',
      url: 'https://example.com/design',
      type: 'document',
      role: null,
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    });
  });

  it('rejects a whitespace-only title', () => {
    expect(() =>
      createRunLink({
        runId: 'run-1' as RunId,
        title: '   ',
        url: 'https://example.com',
        type: 'document',
      }),
    ).toThrow('Link title is required.');
  });
});
