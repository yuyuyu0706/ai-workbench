import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

import {
  dispatchWorkflow,
  workflowActionsUrl,
} from '../github/actions-client.js';
import { GitHubApiError } from '../github/types.js';

const KNOWN_STEPS = ['dummy'] as const;
const PROMPT_TRAIL_RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

type AgentDispatchRequestBody = {
  readonly step?: unknown;
  readonly promptTrailRunId?: unknown;
  readonly issueNumber?: unknown;
  readonly forceFailure?: unknown;
};

/**
 * Dispatches a `PromptTrail Agent Step` workflow_dispatch run. Does not
 * return a run id (GitHub's dispatch API does not provide one) — the
 * caller polls `/api/agent-status` with the same `promptTrailRunId`.
 */
export async function agentDispatch(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  let body: AgentDispatchRequestBody;
  try {
    body = (await request.json()) as AgentDispatchRequestBody;
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  if (
    typeof body.step !== 'string' ||
    !(KNOWN_STEPS as readonly string[]).includes(body.step)
  ) {
    return badRequest(
      `step is required and must be one of: ${KNOWN_STEPS.join(', ')}`,
    );
  }

  if (
    typeof body.promptTrailRunId !== 'string' ||
    !PROMPT_TRAIL_RUN_ID_PATTERN.test(body.promptTrailRunId)
  ) {
    return badRequest(
      'promptTrailRunId is required and must match ^[A-Za-z0-9._-]+$',
    );
  }

  let issueNumber: string | undefined;
  if (body.issueNumber !== undefined) {
    if (typeof body.issueNumber === 'number') {
      issueNumber = String(body.issueNumber);
    } else if (
      typeof body.issueNumber === 'string' &&
      /^[0-9]+$/.test(body.issueNumber)
    ) {
      issueNumber = body.issueNumber;
    } else {
      return badRequest(
        'issueNumber must be a numeric string or number when provided',
      );
    }
  }

  let forceFailure: string | undefined;
  if (body.forceFailure !== undefined) {
    if (typeof body.forceFailure === 'boolean') {
      forceFailure = body.forceFailure ? 'true' : 'false';
    } else if (body.forceFailure === 'true' || body.forceFailure === 'false') {
      forceFailure = body.forceFailure;
    } else {
      return badRequest(
        "forceFailure must be a boolean or 'true'/'false' when provided",
      );
    }
  }

  try {
    await dispatchWorkflow({
      step: body.step,
      promptTrailRunId: body.promptTrailRunId,
      issueNumber,
      forceFailure,
    });

    return {
      status: 202,
      jsonBody: {
        accepted: true,
        promptTrailRunId: body.promptTrailRunId,
        workflowUrl: workflowActionsUrl(),
      },
    };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { status: 502, jsonBody: { error: error.message } };
    }

    return {
      status: 500,
      jsonBody: { error: 'Unexpected error while dispatching the workflow' },
    };
  }
}

function badRequest(message: string): HttpResponseInit {
  return { status: 400, jsonBody: { error: message } };
}

app.http('agent-dispatch', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'agent-dispatch',
  handler: agentDispatch,
});
