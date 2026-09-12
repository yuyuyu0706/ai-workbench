import { unzipSync } from 'fflate';

import { GitHubApiError } from './types.js';

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const DEFAULT_REF = 'main';
const REQUEST_TIMEOUT_MS = 15_000;

export type DispatchWorkflowInputs = {
  readonly step: string;
  readonly promptTrailRunId: string;
  readonly issueNumber?: string;
  readonly forceFailure?: string;
};

export type WorkflowRun = {
  readonly id: number;
  readonly name?: string;
  readonly display_title?: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly html_url: string;
};

export type WorkflowArtifact = {
  readonly id: number;
  readonly name: string;
};

type GitHubConfig = {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly workflowFile: string;
  readonly ref: string;
};

function readConfig(): GitHubConfig {
  const token = process.env.GITHUB_DISPATCH_PAT;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const workflowFile = process.env.AGENT_WORKFLOW_FILE;

  if (!token) {
    throw new GitHubApiError('GITHUB_DISPATCH_PAT is not configured');
  }
  if (!owner) {
    throw new GitHubApiError('GITHUB_OWNER is not configured');
  }
  if (!repo) {
    throw new GitHubApiError('GITHUB_REPO is not configured');
  }
  if (!workflowFile) {
    throw new GitHubApiError('AGENT_WORKFLOW_FILE is not configured');
  }

  return {
    token,
    owner,
    repo,
    workflowFile,
    ref: process.env.AGENT_WORKFLOW_REF || DEFAULT_REF,
  };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

async function githubFetch(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...headers(token), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new GitHubApiError(`Failed to call the GitHub API (${url})`, cause);
  }

  return response;
}

/** Returns the repo's Actions page URL for the configured workflow file. */
export function workflowActionsUrl(): string {
  const { owner, repo, workflowFile } = readConfig();
  return `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;
}

/** Dispatches the configured workflow. Expects a 204 from GitHub on success. */
export async function dispatchWorkflow(
  inputs: DispatchWorkflowInputs,
): Promise<void> {
  const { token, owner, repo, workflowFile, ref } = readConfig();
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  const response = await githubFetch(url, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ref,
      inputs: {
        step: inputs.step,
        promptTrailRunId: inputs.promptTrailRunId,
        ...(inputs.issueNumber !== undefined
          ? { issueNumber: inputs.issueNumber }
          : {}),
        ...(inputs.forceFailure !== undefined
          ? { forceFailure: inputs.forceFailure }
          : {}),
      },
    }),
  });

  if (response.status !== 204) {
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(
      `GitHub workflow dispatch returned an error (${response.status}): ${body}`,
    );
  }
}

/**
 * Finds the most recent workflow_dispatch run whose name (or display_title)
 * contains `marker`. `marker` should already be delimiter-wrapped (e.g.
 * `[promptTrailRunId]`) so that ids that are prefixes of one another cannot
 * collide. Returns `null` when no matching run is found.
 */
export async function findLatestRunByName(
  marker: string,
): Promise<WorkflowRun | null> {
  const { token, owner, repo, workflowFile } = readConfig();
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch`;

  const response = await githubFetch(url, token);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(
      `GitHub list workflow runs returned an error (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as {
    workflow_runs?: readonly WorkflowRun[];
  };
  const runs = data.workflow_runs ?? [];

  return (
    runs.find(
      (run) =>
        (run.name?.includes(marker) ?? false) ||
        (run.display_title?.includes(marker) ?? false),
    ) ?? null
  );
}

/** Fetches a single workflow run by id. Returns `null` when it does not exist. */
export async function getRun(runId: number): Promise<WorkflowRun | null> {
  const { token, owner, repo } = readConfig();
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/runs/${runId}`;

  const response = await githubFetch(url, token);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(
      `GitHub get workflow run returned an error (${response.status}): ${body}`,
    );
  }

  return (await response.json()) as WorkflowRun;
}

/**
 * Finds an artifact for the given run. When `name` is provided, matches it
 * exactly; otherwise returns the first artifact whose name starts with
 * `agent-output-`. Returns `null` when none is found.
 */
export async function findArtifact(
  runId: number,
  name?: string,
): Promise<WorkflowArtifact | null> {
  const { token, owner, repo } = readConfig();
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;

  const response = await githubFetch(url, token);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(
      `GitHub list run artifacts returned an error (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as {
    artifacts?: readonly WorkflowArtifact[];
  };
  const artifacts = data.artifacts ?? [];

  if (name !== undefined) {
    return artifacts.find((artifact) => artifact.name === name) ?? null;
  }

  return (
    artifacts.find((artifact) => artifact.name.startsWith('agent-output-')) ??
    null
  );
}

/**
 * Downloads an artifact's zip and extracts the contents of its single text
 * file as a string. When the zip contains multiple files, prefers one whose
 * name suggests the expected output (`output.md`), falling back to the
 * first file.
 */
export async function downloadArtifactText(
  artifactId: number,
): Promise<string> {
  const { token, owner, repo } = readConfig();
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;

  const response = await githubFetch(url, token);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GitHubApiError(
      `GitHub download artifact returned an error (${response.status}): ${body}`,
    );
  }

  const buffer = new Uint8Array(await response.arrayBuffer());

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(buffer);
  } catch (cause) {
    throw new GitHubApiError('Failed to extract the artifact zip', cause);
  }

  const fileNames = Object.keys(unzipped);
  if (fileNames.length === 0) {
    throw new GitHubApiError('Artifact zip did not contain any files');
  }

  const preferred =
    fileNames.find((fileName) => fileName === 'output.md') ?? fileNames[0];

  return new TextDecoder().decode(unzipped[preferred]);
}
