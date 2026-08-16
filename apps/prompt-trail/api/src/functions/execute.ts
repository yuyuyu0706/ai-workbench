import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

import {
  AiProviderError,
  isAiProviderId,
  resolveAiProvider,
} from '../providers/index.js';

type ExecuteRequestBody = {
  readonly provider?: unknown;
  readonly prompt?: unknown;
  readonly model?: unknown;
  readonly maxTokens?: unknown;
  readonly temperature?: unknown;
  readonly topP?: unknown;
  readonly topK?: unknown;
  readonly stopSequences?: unknown;
};

/**
 * Generic AI Execution Gateway endpoint. Accepts an arbitrary prompt and a
 * provider selection, and returns the provider's generated text as-is. Holds
 * no knowledge of any specific caller (e.g. PLAN generation) — that
 * knowledge stays with the client that composes the prompt.
 */
export async function execute(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  let body: ExecuteRequestBody;
  try {
    body = (await request.json()) as ExecuteRequestBody;
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return badRequest('prompt is required and must be a non-empty string');
  }

  if (!isAiProviderId(body.provider)) {
    return badRequest(
      `provider is required and must be one of: claude, openai`,
    );
  }

  if (body.model !== undefined && typeof body.model !== 'string') {
    return badRequest('model must be a string when provided');
  }

  if (body.maxTokens !== undefined && typeof body.maxTokens !== 'number') {
    return badRequest('maxTokens must be a number when provided');
  }

  if (body.temperature !== undefined && typeof body.temperature !== 'number') {
    return badRequest('temperature must be a number when provided');
  }

  if (body.topP !== undefined && typeof body.topP !== 'number') {
    return badRequest('topP must be a number when provided');
  }

  if (body.topK !== undefined && typeof body.topK !== 'number') {
    return badRequest('topK must be a number when provided');
  }

  if (
    body.stopSequences !== undefined &&
    (!Array.isArray(body.stopSequences) ||
      !body.stopSequences.every((entry) => typeof entry === 'string'))
  ) {
    return badRequest(
      'stopSequences must be an array of strings when provided',
    );
  }

  const aiProvider = resolveAiProvider(body.provider);

  try {
    const output = await aiProvider.generate(body.prompt, {
      model: body.model,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      topP: body.topP,
      topK: body.topK,
      stopSequences: body.stopSequences as readonly string[] | undefined,
    });

    return { status: 200, jsonBody: { output } };
  } catch (error) {
    if (error instanceof AiProviderError) {
      return { status: 502, jsonBody: { error: error.message } };
    }

    return {
      status: 500,
      jsonBody: { error: 'Unexpected error while executing the prompt' },
    };
  }
}

function badRequest(message: string): HttpResponseInit {
  return { status: 400, jsonBody: { error: message } };
}

app.http('execute', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'execute',
  handler: execute,
});
