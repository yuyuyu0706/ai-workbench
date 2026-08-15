/** AI API providers the AI Execution Gateway can dispatch to. Mirrors api/src/providers. */
export const GATEWAY_PROVIDERS = ['claude', 'openai'] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export type CallGatewayExecuteOptions = {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
};

/** Thrown when the AI Execution Gateway (`POST /api/execute`) call fails. */
export class GatewayExecuteError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GatewayExecuteError';
  }
}

/**
 * Calls the generic `POST /api/execute` AI Execution Gateway endpoint and
 * returns the generated output text. Holds no knowledge of any specific
 * caller — the prompt is passed through as-is (see ADR 0009).
 */
export async function callGatewayExecute(
  prompt: string,
  provider: GatewayProvider,
  options: CallGatewayExecuteOptions = {},
): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        prompt,
        model: options.model,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      }),
    });
  } catch {
    throw new GatewayExecuteError('Failed to reach the AI Execution Gateway');
  }

  let payload: { output?: unknown; error?: unknown } = {};
  try {
    payload = await response.json();
  } catch {
    // Fall through: an unparsable body is reported via the status check below.
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `AI Execution Gateway returned an error (${response.status})`;
    throw new GatewayExecuteError(message, response.status);
  }

  if (typeof payload.output !== 'string') {
    throw new GatewayExecuteError(
      'AI Execution Gateway returned an unexpected response',
      response.status,
    );
  }

  return payload.output;
}
