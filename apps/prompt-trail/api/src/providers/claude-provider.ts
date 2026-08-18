import {
  AiProviderError,
  type AiProvider,
  type AiProviderOptions,
} from './types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_TOKENS = 8192;

/** Claude API (Anthropic) provider. Reads its key from ANTHROPIC_API_KEY (ADR 0009). */
export class ClaudeProvider implements AiProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
  ) {}

  async generate(
    prompt: string,
    options: AiProviderOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new AiProviderError(
        'claude',
        'ANTHROPIC_API_KEY is not configured',
      );
    }

    let response: Response;
    try {
      response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_API_VERSION,
        },
        body: JSON.stringify({
          model: options.model ?? DEFAULT_MODEL,
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options.temperature,
          top_p: options.topP,
          top_k: options.topK,
          stop_sequences: options.stopSequences,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (cause) {
      throw new AiProviderError(
        'claude',
        'Failed to call the Claude API',
        cause,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AiProviderError(
        'claude',
        `Claude API returned an error (${response.status}): ${body}`,
      );
    }

    const data = (await response.json()) as {
      content?: ReadonlyArray<{ type: string; text?: string }>;
    };
    const text = data.content
      ?.filter(
        (block) => block.type === 'text' && typeof block.text === 'string',
      )
      .map((block) => block.text)
      .join('');

    if (!text) {
      throw new AiProviderError('claude', 'Claude API returned no text output');
    }

    return text;
  }
}
