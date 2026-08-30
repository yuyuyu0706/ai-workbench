import { afterEach, describe, expect, it, vi } from 'vitest';

import { callGatewayExecute, GatewayExecuteError } from './execute-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callGatewayExecute', () => {
  it('posts to /api/execute and returns the generated output', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ output: 'Generated text' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const output = await callGatewayExecute(
      [{ role: 'user', content: 'Hello' }],
      'claude',
    );

    expect(output).toBe('Generated text');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'claude',
          messages: [{ role: 'user', content: 'Hello' }],
          model: undefined,
          maxTokens: undefined,
          temperature: undefined,
        }),
      }),
    );
  });

  it('throws GatewayExecuteError with the server message on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'provider unavailable' }), {
            status: 502,
          }),
      ),
    );

    await expect(
      callGatewayExecute([{ role: 'user', content: 'Hello' }], 'claude'),
    ).rejects.toThrow(GatewayExecuteError);
    await expect(
      callGatewayExecute([{ role: 'user', content: 'Hello' }], 'claude'),
    ).rejects.toThrow('provider unavailable');
  });

  it('throws GatewayExecuteError when the network call itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(
      callGatewayExecute([{ role: 'user', content: 'Hello' }], 'claude'),
    ).rejects.toThrow(GatewayExecuteError);
  });

  it('throws GatewayExecuteError when the response has no output field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );

    await expect(
      callGatewayExecute([{ role: 'user', content: 'Hello' }], 'claude'),
    ).rejects.toThrow(GatewayExecuteError);
  });
});
