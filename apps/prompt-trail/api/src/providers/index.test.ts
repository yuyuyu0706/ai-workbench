import { describe, expect, it } from 'vitest';

import { ClaudeProvider, OpenAIProvider, resolveAiProvider } from './index.js';

describe('resolveAiProvider', () => {
  it('dispatches "claude" to ClaudeProvider', () => {
    expect(resolveAiProvider('claude')).toBeInstanceOf(ClaudeProvider);
  });

  it('dispatches "openai" to OpenAIProvider', () => {
    expect(resolveAiProvider('openai')).toBeInstanceOf(OpenAIProvider);
  });

  it('throws for an unsupported provider id', () => {
    expect(() => resolveAiProvider('unsupported')).toThrow(
      /Unsupported provider/,
    );
  });

  it('throws for a missing provider id', () => {
    expect(() => resolveAiProvider(undefined)).toThrow(
      /Unsupported provider/,
    );
  });
});
