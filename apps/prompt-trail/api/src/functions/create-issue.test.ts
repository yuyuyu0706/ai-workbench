import { describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

import { createIssue } from './create-issue.js';

function fakeRequest(body: unknown): HttpRequest {
  return { json: async () => body } as unknown as HttpRequest;
}

describe('createIssue', () => {
  it('returns 400 when the body is not valid JSON', async () => {
    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as HttpRequest;

    const response = await createIssue(request, {} as InvocationContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('JSON'),
    });
  });

  it('returns 400 when owner, repo, or title is missing', async () => {
    const missingOwner = await createIssue(
      fakeRequest({ repo: 'ai-workbench', title: 'Hello' }),
      {} as InvocationContext,
    );
    expect(missingOwner.status).toBe(400);

    const missingRepo = await createIssue(
      fakeRequest({ owner: 'yuyuyu0706', title: 'Hello' }),
      {} as InvocationContext,
    );
    expect(missingRepo.status).toBe(400);

    const missingTitle = await createIssue(
      fakeRequest({ owner: 'yuyuyu0706', repo: 'ai-workbench' }),
      {} as InvocationContext,
    );
    expect(missingTitle.status).toBe(400);
  });

  it('returns 400 when body has the wrong type', async () => {
    const response = await createIssue(
      fakeRequest({
        owner: 'yuyuyu0706',
        repo: 'ai-workbench',
        title: 'Hello',
        body: 42,
      }),
      {} as InvocationContext,
    );
    expect(response.status).toBe(400);
  });

  it('returns 502 when GITHUB_PAT is not configured', async () => {
    const originalPat = process.env.GITHUB_PAT;
    delete process.env.GITHUB_PAT;

    try {
      const response = await createIssue(
        fakeRequest({
          owner: 'yuyuyu0706',
          repo: 'ai-workbench',
          title: 'Hello',
        }),
        {} as InvocationContext,
      );

      expect(response.status).toBe(502);
      expect(response.jsonBody).toMatchObject({
        error: expect.stringContaining('GITHUB_PAT'),
      });
    } finally {
      process.env.GITHUB_PAT = originalPat;
    }
  });

  it('returns 200 with the created issue url and number on success', async () => {
    const originalFetch = globalThis.fetch;
    const originalPat = process.env.GITHUB_PAT;
    process.env.GITHUB_PAT = 'test-pat';
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            html_url: 'https://github.com/yuyuyu0706/ai-workbench/issues/302',
            number: 302,
          }),
          { status: 201 },
        ),
    ) as unknown as typeof fetch;

    try {
      const response = await createIssue(
        fakeRequest({
          owner: 'yuyuyu0706',
          repo: 'ai-workbench',
          title: 'Hello',
          body: 'World',
        }),
        {} as InvocationContext,
      );

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        url: 'https://github.com/yuyuyu0706/ai-workbench/issues/302',
        number: 302,
      });
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GITHUB_PAT = originalPat;
    }
  });

  it.each([
    [401, 'Bad credentials'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [422, 'Validation Failed'],
  ])(
    'passes through GitHub API status %i with its message',
    async (status, message) => {
      const originalFetch = globalThis.fetch;
      const originalPat = process.env.GITHUB_PAT;
      process.env.GITHUB_PAT = 'test-pat';
      globalThis.fetch = vi.fn(
        async () => new Response(JSON.stringify({ message }), { status }),
      ) as unknown as typeof fetch;

      try {
        const response = await createIssue(
          fakeRequest({
            owner: 'yuyuyu0706',
            repo: 'ai-workbench',
            title: 'Hello',
          }),
          {} as InvocationContext,
        );

        expect(response.status).toBe(status);
        expect(response.jsonBody).toEqual({ error: message });
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GITHUB_PAT = originalPat;
      }
    },
  );

  it('returns 502 when the GitHub API is unreachable', async () => {
    const originalFetch = globalThis.fetch;
    const originalPat = process.env.GITHUB_PAT;
    process.env.GITHUB_PAT = 'test-pat';
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network error');
    }) as unknown as typeof fetch;

    try {
      const response = await createIssue(
        fakeRequest({
          owner: 'yuyuyu0706',
          repo: 'ai-workbench',
          title: 'Hello',
        }),
        {} as InvocationContext,
      );

      expect(response.status).toBe(502);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GITHUB_PAT = originalPat;
    }
  });
});
