import { strToU8, zipSync } from 'fflate';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { agentStatus } from './agent-status.js';

const ORIGINAL_ENV = { ...process.env };

function fakeRequest(query: Record<string, string>): HttpRequest {
  return { query: new URLSearchParams(query) } as unknown as HttpRequest;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env.GITHUB_DISPATCH_PAT = 'test-pat';
  process.env.GITHUB_OWNER = 'test-owner';
  process.env.GITHUB_REPO = 'test-repo';
  process.env.AGENT_WORKFLOW_FILE = 'agent-step.yml';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('agentStatus', () => {
  it('returns 400 when neither promptTrailRunId nor runId is provided', async () => {
    const response = await agentStatus(
      fakeRequest({}),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
  });

  it('returns 200 with state pending when the run has not appeared yet', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ workflow_runs: [] }),
    ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      state: 'pending',
      runId: null,
      htmlUrl: null,
    });
  });

  it('returns state in-progress while the run is queued/in_progress', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        workflow_runs: [
          {
            id: 10,
            name: 'Agent step: dummy [run-1]',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://example.com/runs/10',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ state: 'in-progress' });
  });

  it('returns state success with output when completed and successful', async () => {
    const zipped = zipSync({ 'output.md': strToU8('output body') });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          workflow_runs: [
            {
              id: 11,
              name: 'Agent step: dummy [run-1]',
              status: 'completed',
              conclusion: 'success',
              html_url: 'https://example.com/runs/11',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          artifacts: [{ id: 99, name: 'agent-output-run-1' }],
        }),
      )
      .mockResolvedValueOnce(
        new Response(zipped, { status: 200 }),
      ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      state: 'success',
      output: 'output body',
      raw: { status: 'completed', conclusion: 'success' },
    });
  });

  it('returns output even when the run failed', async () => {
    const zipped = zipSync({ 'output.md': strToU8('failure output') });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          workflow_runs: [
            {
              id: 12,
              name: 'Agent step: dummy [run-1]',
              status: 'completed',
              conclusion: 'failure',
              html_url: 'https://example.com/runs/12',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          artifacts: [{ id: 100, name: 'agent-output-run-1' }],
        }),
      )
      .mockResolvedValueOnce(
        new Response(zipped, { status: 200 }),
      ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      state: 'failure',
      output: 'failure output',
    });
  });

  it('returns state cancelled for a cancelled run', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        workflow_runs: [
          {
            id: 13,
            name: 'Agent step: dummy [run-1]',
            status: 'completed',
            conclusion: 'cancelled',
            html_url: 'https://example.com/runs/13',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ state: 'cancelled' });
  });

  it('rolls unknown conclusions up to failure and keeps raw', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          workflow_runs: [
            {
              id: 14,
              name: 'Agent step: dummy [run-1]',
              status: 'completed',
              conclusion: 'timed_out',
              html_url: 'https://example.com/runs/14',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ artifacts: [] }),
      ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      state: 'failure',
      raw: { status: 'completed', conclusion: 'timed_out' },
    });
  });

  it('returns 404 when an explicit runId does not exist', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ runId: '999' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(404);
  });

  it('returns 502 when GitHub returns an error', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('server error', { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await agentStatus(
      fakeRequest({ promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(502);
  });
});
