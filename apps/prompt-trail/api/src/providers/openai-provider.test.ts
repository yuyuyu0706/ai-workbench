import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiProviderError } from './types.js';
import { OpenAIProvider } from './openai-provider.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAIProvider', () => {
  it('throws when OPENAI_API_KEY is not configured', async () => {
    const provider = new OpenAIProvider(undefined);

    await expect(provider.generate('Hello')).rejects.toThrow(AiProviderError);
  });

  it('returns the generated text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Generated text' } }],
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new OpenAIProvider('test-key');
    const output = await provider.generate('Hello');

    expect(output).toBe('Generated text');
  });

  it('throws AiProviderError when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    const provider = new OpenAIProvider('test-key');

    await expect(provider.generate('Hello')).rejects.toThrow(AiProviderError);
  });

  it('throws AiProviderError when the network call itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const provider = new OpenAIProvider('test-key');

    await expect(provider.generate('Hello')).rejects.toThrow(AiProviderError);
  });

  it('throws AiProviderError when the response has no message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );

    const provider = new OpenAIProvider('test-key');

    await expect(provider.generate('Hello')).rejects.toThrow(AiProviderError);
  });
});
