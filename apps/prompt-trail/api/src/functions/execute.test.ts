import { describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

import { execute } from './execute.js';

function fakeRequest(body: unknown): HttpRequest {
  return { json: async () => body } as unknown as HttpRequest;
}

describe('execute', () => {
  it('returns 400 when the body is not valid JSON', async () => {
    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as HttpRequest;

    const response = await execute(request, {} as InvocationContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('JSON'),
    });
  });

  it('returns 400 when prompt is missing', async () => {
    const response = await execute(
      fakeRequest({ provider: 'claude' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('prompt'),
    });
  });

  it('returns 400 when prompt is an empty string', async () => {
    const response = await execute(
      fakeRequest({ provider: 'claude', prompt: '   ' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when provider is missing or invalid', async () => {
    const missing = await execute(
      fakeRequest({ prompt: 'Hello' }),
      {} as InvocationContext,
    );
    expect(missing.status).toBe(400);

    const invalid = await execute(
      fakeRequest({ prompt: 'Hello', provider: 'not-a-provider' }),
      {} as InvocationContext,
    );
    expect(invalid.status).toBe(400);
  });

  it('returns 400 when optional numeric/string fields have the wrong type', async () => {
    const badModel = await execute(
      fakeRequest({ prompt: 'Hello', provider: 'claude', model: 42 }),
      {} as InvocationContext,
    );
    expect(badModel.status).toBe(400);

    const badMaxTokens = await execute(
      fakeRequest({
        prompt: 'Hello',
        provider: 'claude',
        maxTokens: 'lots',
      }),
      {} as InvocationContext,
    );
    expect(badMaxTokens.status).toBe(400);

    const badTemperature = await execute(
      fakeRequest({
        prompt: 'Hello',
        provider: 'claude',
        temperature: 'warm',
      }),
      {} as InvocationContext,
    );
    expect(badTemperature.status).toBe(400);
  });

  it('returns 200 with the generated output on success', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: 'Generated text' }],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    try {
      const response = await execute(
        fakeRequest({ prompt: 'Hello', provider: 'claude' }),
        {} as InvocationContext,
      );

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({ output: 'Generated text' });
    } finally {
      globalThis.fetch = originalFetch;
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it('returns 502 when the provider call fails', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const response = await execute(
        fakeRequest({ prompt: 'Hello', provider: 'claude' }),
        {} as InvocationContext,
      );

      expect(response.status).toBe(502);
      expect(response.jsonBody).toMatchObject({
        error: expect.stringContaining('ANTHROPIC_API_KEY'),
      });
    } finally {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });
});
