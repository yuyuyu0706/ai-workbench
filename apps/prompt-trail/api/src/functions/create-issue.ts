import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

const GITHUB_API_BASE_URL = 'https://api.github.com';

type CreateIssueRequestBody = {
  readonly owner?: unknown;
  readonly repo?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
};

/**
 * GitHub Issue creation endpoint. Accepts an owner/repo and issue
 * title/body, and creates the issue via the GitHub REST API using the
 * server-side GITHUB_PAT. GitHub API errors are passed through as-is
 * (same policy as /api/execute — see ADR 0009).
 */
export async function createIssue(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  let requestBody: CreateIssueRequestBody;
  try {
    requestBody = (await request.json()) as CreateIssueRequestBody;
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  if (
    typeof requestBody.owner !== 'string' ||
    requestBody.owner.trim() === ''
  ) {
    return badRequest('owner is required and must be a non-empty string');
  }

  if (typeof requestBody.repo !== 'string' || requestBody.repo.trim() === '') {
    return badRequest('repo is required and must be a non-empty string');
  }

  if (
    typeof requestBody.title !== 'string' ||
    requestBody.title.trim() === ''
  ) {
    return badRequest('title is required and must be a non-empty string');
  }

  if (requestBody.body !== undefined && typeof requestBody.body !== 'string') {
    return badRequest('body must be a string when provided');
  }

  const githubPat = process.env.GITHUB_PAT;
  if (!githubPat) {
    return {
      status: 502,
      jsonBody: { error: 'GITHUB_PAT is not configured' },
    };
  }

  const owner = requestBody.owner;
  const repo = requestBody.repo;

  let response: Response;
  try {
    response = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${githubPat}`,
          accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          title: requestBody.title,
          body: requestBody.body,
        }),
      },
    );
  } catch {
    return {
      status: 502,
      jsonBody: { error: 'Failed to reach the GitHub API' },
    };
  }

  let payload: { html_url?: unknown; number?: unknown; message?: unknown } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Fall through: an unparsable body is reported via the checks below.
  }

  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : `GitHub API returned an error (${response.status})`;
    return { status: response.status, jsonBody: { error: message } };
  }

  if (
    typeof payload.html_url !== 'string' ||
    typeof payload.number !== 'number'
  ) {
    return {
      status: 502,
      jsonBody: { error: 'GitHub API returned an unexpected response' },
    };
  }

  return {
    status: 200,
    jsonBody: { url: payload.html_url, number: payload.number },
  };
}

function badRequest(message: string): HttpResponseInit {
  return { status: 400, jsonBody: { error: message } };
}

app.http('create-issue', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'create-issue',
  handler: createIssue,
});
