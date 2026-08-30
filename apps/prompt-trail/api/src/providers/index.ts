import { ClaudeProvider } from './claude-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { isAiProviderId, type AiProvider, type AiProviderId } from './types.js';

export {
  AI_PROVIDER_IDS,
  AiProviderError,
  isAiProviderId,
  type AiProvider,
  type AiProviderId,
  type AiProviderOptions,
  type ConversationMessage,
  type ConversationRole,
} from './types.js';
export { ClaudeProvider } from './claude-provider.js';
export { OpenAIProvider } from './openai-provider.js';

/** Resolves the AiProvider implementation for a request-supplied provider id. */
export function resolveAiProvider(providerId: unknown): AiProvider {
  if (!isAiProviderId(providerId)) {
    throw new TypeError(`Unsupported provider: ${String(providerId)}`);
  }

  return createAiProvider(providerId);
}

function createAiProvider(providerId: AiProviderId): AiProvider {
  switch (providerId) {
    case 'claude':
      return new ClaudeProvider();
    case 'openai':
      return new OpenAIProvider();
  }
}
