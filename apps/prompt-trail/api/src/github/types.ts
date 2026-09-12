/** Thrown when a GitHub API call fails (missing PAT, network/API error, etc.). */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}
