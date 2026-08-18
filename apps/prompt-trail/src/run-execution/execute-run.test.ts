import { describe, expect, it, vi } from 'vitest';

import type { Run } from '../domain';
import { GatewayExecuteError } from '../gateway/execute-client';
import type { PromptTrailRepository } from '../repository';
import { executeRun } from './execute-run';

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'project-1',
    trailId: 'trail-1',
    recipeId: null,
    promptSnapshot: {
      promptId: 'prompt-1',
      title: 'Title',
      body: 'Prompt body',
    },
    contextSnapshots: [],
    inputValues: {},
    finalPrompt: 'Prompt body',
    status: 'draft',
    evaluation: null,
    improvementNote: null,
    output: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
    ...overrides,
  } as unknown as Run;
}

describe('executeRun', () => {
  it('sends the prompt snapshot body to the gateway with the claude default and persists the output', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ output: 'Generated text' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const run = buildRun();
    const savedRun = { ...run, output: 'Generated text' };
    const saveRun = vi.fn(async (input: Run) => ({ ...input }));
    const repository = { saveRun } as unknown as PromptTrailRepository;
    const now = () => '2026-01-02T00:00:00.000Z' as Run['updatedAt'];

    const result = await executeRun(repository, run, {}, now);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({
        body: JSON.stringify({
          provider: 'claude',
          prompt: 'Prompt body',
          model: undefined,
          maxTokens: undefined,
          temperature: undefined,
          topP: undefined,
          topK: undefined,
          stopSequences: undefined,
        }),
      }),
    );
    expect(saveRun).toHaveBeenCalledWith({
      ...run,
      output: 'Generated text',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(result).toEqual({
      ...savedRun,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    vi.unstubAllGlobals();
  });

  it('passes through the requested provider and options', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ output: 'OpenAI output' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const run = buildRun();
    const saveRun = vi.fn(async (input: Run) => input);
    const repository = { saveRun } as unknown as PromptTrailRepository;

    await executeRun(repository, run, {
      provider: 'openai',
      model: 'gpt-test',
      maxTokens: 2048,
      temperature: 0.5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({
        body: JSON.stringify({
          provider: 'openai',
          prompt: 'Prompt body',
          model: 'gpt-test',
          maxTokens: 2048,
          temperature: 0.5,
          topP: undefined,
          topK: undefined,
          stopSequences: undefined,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('propagates GatewayExecuteError without catching it, and does not persist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const run = buildRun();
    const saveRun = vi.fn();
    const repository = { saveRun } as unknown as PromptTrailRepository;

    await expect(executeRun(repository, run)).rejects.toBeInstanceOf(
      GatewayExecuteError,
    );
    expect(saveRun).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
