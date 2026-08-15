/**
 * Thin common interface every AI API provider implements. Deliberately kept
 * to "input prompt -> generated text" per ADR 0009 — no provider-specific or
 * PLAN-specific knowledge belongs here.
 */
export interface AiProvider {
  generate(prompt: string, options?: AiProviderOptions): Promise<string>;
}

export type AiProviderOptions = {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
};

export const AI_PROVIDER_IDS = ['claude', 'openai'] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export function isAiProviderId(value: unknown): value is AiProviderId {
  return (
    typeof value === 'string' &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/** Thrown when a provider call fails (missing key, network/API error, etc.). */
export class AiProviderError extends Error {
  constructor(
    public readonly providerId: AiProviderId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
