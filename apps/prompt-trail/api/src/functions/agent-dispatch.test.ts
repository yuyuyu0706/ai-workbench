import type { HttpRequest, InvocationContext } from '@azure/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { agentDispatch } from './agent-dispatch.js';

const ORIGINAL_ENV = { ...process.env };

function fakeRequest(body: unknown): HttpRequest {
  return { json: async () => body } as unknown as HttpRequest;
}

function setGithubEnv(): void {
  process.env.GITHUB_DISPATCH_PAT = 'test-pat';
  process.env.GITHUB_OWNER = 'test-owner';
  process.env.GITHUB_REPO = 'test-repo';
  process.env.AGENT_WORKFLOW_FILE = 'agent-step.yml';
}

beforeEach(() => {
  setGithubEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('agentDispatch', () => {
  it('returns 400 when the body is not valid JSON', async () => {
    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as HttpRequest;

    const response = await agentDispatch(request, {} as InvocationContext);

    expect(response.status).toBe(400);
  });

  it('returns 400 when step is unknown', async () => {
    const response = await agentDispatch(
      fakeRequest({ step: 'not-a-step', promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('step'),
    });
  });

  it('returns 400 when promptTrailRunId has an invalid format', async () => {
    const response = await agentDispatch(
      fakeRequest({ step: 'dummy', promptTrailRunId: 'lv4-2/local' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('promptTrailRunId'),
    });
  });

  it('returns 400 when issueNumber is not numeric', async () => {
    const response = await agentDispatch(
      fakeRequest({
        step: 'dummy',
        promptTrailRunId: 'run-1',
        issueNumber: 'abc',
      }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      error: expect.stringContaining('issueNumber'),
    });
  });

  it('returns 502 when GITHUB_DISPATCH_PAT is not configured', async () => {
    delete process.env.GITHUB_DISPATCH_PAT;

    const response = await agentDispatch(
      fakeRequest({ step: 'dummy', promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(502);
  });

  it('returns 502 when GitHub returns an error', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('server error', { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await agentDispatch(
      fakeRequest({ step: 'dummy', promptTrailRunId: 'run-1' }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(502);
  });

  it('returns 202 with the dispatch acceptance on success', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;

    const response = await agentDispatch(
      fakeRequest({
        step: 'dummy',
        promptTrailRunId: 'run-1',
        issueNumber: 42,
        forceFailure: false,
      }),
      {} as InvocationContext,
    );

    expect(response.status).toBe(202);
    expect(response.jsonBody).toMatchObject({
      accepted: true,
      promptTrailRunId: 'run-1',
      workflowUrl: expect.stringContaining('agent-step.yml'),
    });
  });
});
