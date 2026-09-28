import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentExecutionError } from './errors';
import { dispatchAgentStep, fetchAgentStatus } from './agent-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dispatchAgentStep', () => {
  it('posts to /api/agent-dispatch and returns the 202 response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            accepted: true,
            promptTrailRunId: 'agent-1',
            workflowUrl: 'https://github.com/example/example/actions',
          }),
          { status: 202 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await dispatchAgentStep({
      step: 'dummy',
      promptTrailRunId: 'agent-1',
      forceFailure: false,
    });

    expect(result).toEqual({
      accepted: true,
      promptTrailRunId: 'agent-1',
      workflowUrl: 'https://github.com/example/example/actions',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent-dispatch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          step: 'dummy',
          promptTrailRunId: 'agent-1',
          forceFailure: false,
        }),
      }),
    );
  });

  it('throws AgentExecutionError with the server message on a 400 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'step is required' }), {
            status: 400,
          }),
      ),
    );

    await expect(
      dispatchAgentStep({ step: 'dummy', promptTrailRunId: 'agent-1' }),
    ).rejects.toThrow(AgentExecutionError);
    await expect(
      dispatchAgentStep({ step: 'dummy', promptTrailRunId: 'agent-1' }),
    ).rejects.toThrow('step is required');
  });

  it('throws AgentExecutionError with the status preserved on a 502 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'GitHub API error' }), {
            status: 502,
          }),
      ),
    );

    await expect(
      dispatchAgentStep({ step: 'dummy', promptTrailRunId: 'agent-1' }),
    ).rejects.toMatchObject({ status: 502, message: 'GitHub API error' });
  });

  it('rejects with an AbortError when the signal is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new DOMException('Aborted', 'AbortError');
        throw error;
      }),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      dispatchAgentStep(
        { step: 'dummy', promptTrailRunId: 'agent-1' },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchAgentStatus', () => {
  it('gets /api/agent-status and returns the parsed response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            state: 'success',
            runId: 123,
            htmlUrl: 'https://github.com/example/example/actions/runs/123',
            output: 'Generated output',
            raw: { status: 'completed', conclusion: 'success' },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAgentStatus({ promptTrailRunId: 'agent-1' });

    expect(result).toEqual({
      state: 'success',
      runId: 123,
      htmlUrl: 'https://github.com/example/example/actions/runs/123',
      output: 'Generated output',
      raw: { status: 'completed', conclusion: 'success' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent-status?promptTrailRunId=agent-1',
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('throws AgentExecutionError on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'GitHub API error' }), {
            status: 502,
          }),
      ),
    );

    await expect(
      fetchAgentStatus({ promptTrailRunId: 'agent-1' }),
    ).rejects.toThrow(AgentExecutionError);
  });

  it('rejects with an AbortError instead of wrapping it, when aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      }),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchAgentStatus({ promptTrailRunId: 'agent-1' }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
