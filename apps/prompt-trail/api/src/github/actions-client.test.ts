import { strFromU8, strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dispatchWorkflow,
  downloadArtifactText,
  findLatestRunByName,
} from './actions-client.js';
import { GitHubApiError } from './types.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GITHUB_DISPATCH_PAT = 'test-pat';
  process.env.GITHUB_OWNER = 'test-owner';
  process.env.GITHUB_REPO = 'test-repo';
  process.env.AGENT_WORKFLOW_FILE = 'agent-step.yml';
  delete process.env.AGENT_WORKFLOW_REF;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('dispatchWorkflow', () => {
  it('throws GitHubApiError when GITHUB_DISPATCH_PAT is not configured', async () => {
    delete process.env.GITHUB_DISPATCH_PAT;

    await expect(
      dispatchWorkflow({ step: 'dummy', promptTrailRunId: 'run-1' }),
    ).rejects.toBeInstanceOf(GitHubApiError);
  });

  it('throws GitHubApiError when the dispatch response is not 204', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(
      dispatchWorkflow({ step: 'dummy', promptTrailRunId: 'run-1' }),
    ).rejects.toBeInstanceOf(GitHubApiError);
  });

  it('resolves without error on a 204 response', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;

    await expect(
      dispatchWorkflow({ step: 'dummy', promptTrailRunId: 'run-1' }),
    ).resolves.toBeUndefined();
  });
});

describe('findLatestRunByName', () => {
  it('does not false-positive when one id is a prefix of another', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            workflow_runs: [
              {
                id: 1,
                name: 'Agent step: dummy [lv4-2-local-extra]',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://example.com/runs/1',
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const run = await findLatestRunByName('[lv4-2-local]');

    expect(run).toBeNull();
  });

  it('returns the matching run when the marker is present', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            workflow_runs: [
              {
                id: 2,
                name: 'Agent step: dummy [lv4-2-local]',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://example.com/runs/2',
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const run = await findLatestRunByName('[lv4-2-local]');

    expect(run?.id).toBe(2);
  });
});

describe('downloadArtifactText', () => {
  it('extracts the single file content from the zip', async () => {
    const zipped = zipSync({
      'output.md': strToU8('# Agent step (dummy)\n'),
    });

    globalThis.fetch = vi.fn(
      async () => new Response(zipped, { status: 200 }),
    ) as unknown as typeof fetch;

    const text = await downloadArtifactText(123);

    expect(text).toBe(strFromU8(strToU8('# Agent step (dummy)\n')));
  });
});
