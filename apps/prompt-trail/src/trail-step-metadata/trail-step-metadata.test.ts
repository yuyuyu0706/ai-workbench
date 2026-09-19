import { describe, expect, it } from 'vitest';
import { TRAIL_STEP_KINDS } from '../domain';
import {
  isTrailStepKind,
  normalizeTrailStepTitle,
  TRAIL_STEP_KIND_LABELS,
  validateTrailStepMetadata,
} from '.';

describe('trail step metadata', () => {
  it('provides a Japanese label for every TrailStepKind in domain order', () => {
    expect(
      TRAIL_STEP_KINDS.map((kind) => TRAIL_STEP_KIND_LABELS[kind]),
    ).toEqual(['Promptを実行する工程', '人手の工程']);
    expect(isTrailStepKind('prompt')).toBe(true);
    expect(isTrailStepKind('unknown')).toBe(false);
  });

  it('normalizes whitespace-padded titles', () => {
    expect(normalizeTrailStepTitle('  Step name  ')).toBe('Step name');
  });

  it('requires a title, rejects too-long titles, and rejects newlines', () => {
    expect(
      validateTrailStepMetadata({
        title: '   ',
        kind: 'prompt',
        promptId: 'prompt-1',
      }),
    ).toEqual(['step-title-required']);
    expect(
      validateTrailStepMetadata({
        title: 'a'.repeat(81),
        kind: 'prompt',
        promptId: 'prompt-1',
      }),
    ).toEqual(['step-title-too-long']);
    expect(
      validateTrailStepMetadata({
        title: 'line one\nline two',
        kind: 'prompt',
        promptId: 'prompt-1',
      }),
    ).toEqual(['step-title-newline']);
  });

  it('rejects an unknown kind', () => {
    expect(
      validateTrailStepMetadata({
        title: 'Step',
        kind: 'unknown',
        promptId: null,
      }),
    ).toEqual(['step-kind-invalid']);
  });

  it('requires promptId when kind is prompt', () => {
    expect(
      validateTrailStepMetadata({
        title: 'Step',
        kind: 'prompt',
        promptId: null,
      }),
    ).toEqual(['step-prompt-id-required']);
  });

  it('forbids promptId when kind is manual', () => {
    expect(
      validateTrailStepMetadata({
        title: 'Step',
        kind: 'manual',
        promptId: 'prompt-1',
      }),
    ).toEqual(['step-prompt-id-not-allowed']);
  });

  it('accepts valid prompt and manual metadata with no errors', () => {
    expect(
      validateTrailStepMetadata({
        title: 'Step',
        kind: 'prompt',
        promptId: 'prompt-1',
      }),
    ).toEqual([]);
    expect(
      validateTrailStepMetadata({
        title: 'Step',
        kind: 'manual',
        promptId: null,
      }),
    ).toEqual([]);
  });
});
