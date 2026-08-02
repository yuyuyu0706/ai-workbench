import { describe, expect, it } from 'vitest';
import { resolveNewTrailSource } from './resolve-new-trail-source';

describe('resolveNewTrailSource', () => {
  it.each([
    ['', { kind: 'blank' }],
    ['sourceRunId=run%2F1', { kind: 'run', runId: 'run/1' }],
    ['sourcePromptId=prompt%2F1', { kind: 'prompt', promptId: 'prompt/1' }],
  ])('resolves %s', (query, expected) => {
    expect(resolveNewTrailSource(new URLSearchParams(query))).toEqual(expected);
  });

  it.each([
    'sourceRunId=',
    'sourcePromptId=%20',
    'sourceRunId=a&sourcePromptId=b',
    'sourceRunId=a&sourceRunId=b',
    'sourcePromptId=a&sourcePromptId=b',
  ])('rejects ambiguous source query %s', (query) => {
    expect(resolveNewTrailSource(new URLSearchParams(query))).toEqual({
      kind: 'invalid',
    });
  });
});
