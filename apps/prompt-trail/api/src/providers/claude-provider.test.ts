import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiProviderError } from './types.js';
import { ClaudeProvider } from './claude-provider.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClaudeProvider', () => {
  it('throws when ANTHROPIC_API_KEY is not configured', async () => {
    const provider = new ClaudeProvider(undefined);

    await expect(
      provider.generate([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(AiProviderError);
  });

  it('returns the generated text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [{ type: 'text', text: 'Generated text' }],
            }),
            { status: 200 },
          ),
      ),
    );

    const provider = new ClaudeProvider('test-key');
    const output = await provider.generate([
      { role: 'user', content: 'Hello' },
    ]);

    expect(output).toBe('Generated text');
  });

  it('throws AiProviderError when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    const provider = new ClaudeProvider('test-key');

    await expect(
      provider.generate([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(AiProviderError);
  });

  it('throws AiProviderError when the network call itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const provider = new ClaudeProvider('test-key');

    await expect(
      provider.generate([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(AiProviderError);
  });

  it('sends the full conversation history to the Claude API as-is', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: 'Reply' }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ClaudeProvider('test-key');
    const messages = [
      { role: 'user' as const, content: 'First turn' },
      { role: 'assistant' as const, content: 'First reply' },
      { role: 'user' as const, content: 'Second turn' },
    ];
    await provider.generate(messages);

    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(requestInit.body as string);
    expect(requestBody.messages).toEqual(messages);
  });

  it('throws AiProviderError when the response has no text content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ content: [] }), { status: 200 }),
      ),
    );

    const provider = new ClaudeProvider('test-key');

    await expect(
      provider.generate([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(AiProviderError);
  });
});
