import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  callGatewayCreateIssue,
  GatewayCreateIssueError,
} from './create-issue-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callGatewayCreateIssue', () => {
  it('posts to /api/create-issue and returns the created issue url and number', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: 'https://github.com/yuyuyu0706/ai-workbench/issues/302',
            number: 302,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGatewayCreateIssue(
      'yuyuyu0706',
      'ai-workbench',
      'Hello',
      'World',
    );

    expect(result).toEqual({
      url: 'https://github.com/yuyuyu0706/ai-workbench/issues/302',
      number: 302,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/create-issue',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          owner: 'yuyuyu0706',
          repo: 'ai-workbench',
          title: 'Hello',
          body: 'World',
        }),
      }),
    );
  });

  it('throws GatewayCreateIssueError with the server message on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
          }),
      ),
    );

    await expect(
      callGatewayCreateIssue('yuyuyu0706', 'ai-workbench', 'Hello', ''),
    ).rejects.toThrow(GatewayCreateIssueError);
    await expect(
      callGatewayCreateIssue('yuyuyu0706', 'ai-workbench', 'Hello', ''),
    ).rejects.toThrow('Not Found');
  });

  it('throws GatewayCreateIssueError when the network call itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(
      callGatewayCreateIssue('yuyuyu0706', 'ai-workbench', 'Hello', ''),
    ).rejects.toThrow(GatewayCreateIssueError);
  });

  it('throws GatewayCreateIssueError when the response has no url/number fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );

    await expect(
      callGatewayCreateIssue('yuyuyu0706', 'ai-workbench', 'Hello', ''),
    ).rejects.toThrow(GatewayCreateIssueError);
  });
});
