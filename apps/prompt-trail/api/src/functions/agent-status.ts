import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

import {
  downloadArtifactText,
  findArtifact,
  findLatestRunByName,
  getRun,
  type WorkflowRun,
} from '../github/actions-client.js';
import { GitHubApiError } from '../github/types.js';

type AgentState =
  'pending' | 'in-progress' | 'success' | 'failure' | 'cancelled';

const IN_PROGRESS_STATUSES = new Set([
  'queued',
  'in_progress',
  'waiting',
  'requested',
  'pending',
]);

/**
 * Reports the state of a dispatched agent-step run. Resolves the run either
 * from an explicit `runId`, or by searching the workflow's runs for one
 * whose name contains the `promptTrailRunId` marker (see `run-name:` in
 * `agent-step.yml`).
 */
export async function agentStatus(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const runIdParam = request.query.get('runId');
  const promptTrailRunId = request.query.get('promptTrailRunId');

  if (!runIdParam && !promptTrailRunId) {
    return badRequest('either runId or promptTrailRunId is required');
  }

  let explicitRunId: number | undefined;
  if (runIdParam) {
    explicitRunId = Number(runIdParam);
    if (!Number.isFinite(explicitRunId) || !Number.isInteger(explicitRunId)) {
      return badRequest('runId must be an integer when provided');
    }
  }

  try {
    let run: WorkflowRun | null;
    if (explicitRunId !== undefined) {
      run = await getRun(explicitRunId);
      if (run === null) {
        return {
          status: 404,
          jsonBody: { error: `Run ${explicitRunId} was not found` },
        };
      }
    } else {
      run = await findLatestRunByName(`[${promptTrailRunId}]`);
    }

    if (run === null) {
      return {
        status: 200,
        jsonBody: {
          state: 'pending' satisfies AgentState,
          runId: null,
          htmlUrl: null,
          raw: { status: null, conclusion: null },
        },
      };
    }

    const state = mapState(run.status, run.conclusion);

    let output: string | undefined;
    if (run.status === 'completed') {
      const artifactName =
        explicitRunId !== undefined && !promptTrailRunId
          ? undefined
          : `agent-output-${promptTrailRunId}`;
      const artifact = await findArtifact(run.id, artifactName);
      if (artifact !== null) {
        output = await downloadArtifactText(artifact.id);
      }
    }

    return {
      status: 200,
      jsonBody: {
        state,
        runId: run.id,
        htmlUrl: run.html_url,
        ...(output !== undefined ? { output } : {}),
        raw: { status: run.status, conclusion: run.conclusion },
      },
    };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { status: 502, jsonBody: { error: error.message } };
    }

    return {
      status: 500,
      jsonBody: { error: 'Unexpected error while fetching agent status' },
    };
  }
}

function mapState(
  status: string | null,
  conclusion: string | null,
): AgentState {
  if (status !== 'completed') {
    if (status !== null && IN_PROGRESS_STATUSES.has(status)) {
      return 'in-progress';
    }
    return 'in-progress';
  }

  if (conclusion === 'success') {
    return 'success';
  }
  if (conclusion === 'cancelled') {
    return 'cancelled';
  }
  // failure and any other/unknown conclusion (timed_out, neutral, skipped,
  // stale, action_required) roll up to failure; `raw` retains the real value.
  return 'failure';
}

function badRequest(message: string): HttpResponseInit {
  return { status: 400, jsonBody: { error: message } };
}

app.http('agent-status', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'agent-status',
  handler: agentStatus,
});
