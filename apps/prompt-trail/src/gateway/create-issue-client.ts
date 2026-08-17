/** Thrown when the GitHub Issue creation gateway (`POST /api/create-issue`) call fails. */
export class GatewayCreateIssueError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GatewayCreateIssueError';
  }
}

export type CallGatewayCreateIssueResult = {
  readonly url: string;
  readonly number: number;
};

/**
 * Calls the `POST /api/create-issue` gateway endpoint to create a GitHub
 * Issue in the given owner/repo, and returns the created issue's URL and
 * number.
 */
export async function callGatewayCreateIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
): Promise<CallGatewayCreateIssueResult> {
  let response: Response;
  try {
    response = await fetch('/api/create-issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner, repo, title, body }),
    });
  } catch {
    throw new GatewayCreateIssueError(
      'Failed to reach the GitHub Issue creation gateway',
    );
  }

  let payload: { url?: unknown; number?: unknown; error?: unknown } = {};
  try {
    payload = await response.json();
  } catch {
    // Fall through: an unparsable body is reported via the status check below.
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `GitHub Issue creation gateway returned an error (${response.status})`;
    throw new GatewayCreateIssueError(message, response.status);
  }

  if (typeof payload.url !== 'string' || typeof payload.number !== 'number') {
    throw new GatewayCreateIssueError(
      'GitHub Issue creation gateway returned an unexpected response',
      response.status,
    );
  }

  return { url: payload.url, number: payload.number };
}
