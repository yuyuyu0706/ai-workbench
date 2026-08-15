import {
  AiProviderError,
  type AiProvider,
  type AiProviderOptions,
} from './types.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 1024;

/** OpenAI API (GPT/Codex) provider. Reads its key from OPENAI_API_KEY (ADR 0009). */
export class OpenAIProvider implements AiProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY,
  ) {}

  async generate(
    prompt: string,
    options: AiProviderOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new AiProviderError('openai', 'OPENAI_API_KEY is not configured');
    }

    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? DEFAULT_MODEL,
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options.temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (cause) {
      throw new AiProviderError(
        'openai',
        'Failed to call the OpenAI API',
        cause,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AiProviderError(
        'openai',
        `OpenAI API returned an error (${response.status}): ${body}`,
      );
    }

    const data = (await response.json()) as {
      choices?: ReadonlyArray<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new AiProviderError(
        'openai',
        'OpenAI API returned no text output',
      );
    }

    return text;
  }
}
