import { describe, expect, it } from 'vitest';
import { TRAIL_KINDS } from '../domain';
import {
  isTrailKind,
  normalizeTrailTitle,
  TRAIL_KIND_LABELS,
  validateTrailMetadata,
} from '.';

describe('trail metadata', () => {
  it('provides a Japanese label for every TrailKind in domain order', () => {
    expect(TRAIL_KINDS.map((kind) => TRAIL_KIND_LABELS[kind])).toEqual([
      '企画・設計',
      '開発',
      '調査',
      'レビュー',
      '障害対応',
      'その他',
    ]);
    expect(isTrailKind('development')).toBe(true);
    expect(isTrailKind('codex-request')).toBe(false);
  });

  it('normalizes valid titles and reports every invalid metadata shape', () => {
    expect(normalizeTrailTitle('  Trail name  ')).toBe('Trail name');
    expect(
      validateTrailMetadata({ trailTitle: ' \n', trailKind: 'unknown' }),
    ).toEqual([
      'trail-title-required',
      'trail-title-newline',
      'trail-kind-invalid',
    ]);
    expect(
      validateTrailMetadata({ trailTitle: 'a'.repeat(81), trailKind: 'other' }),
    ).toEqual(['trail-title-too-long']);
  });
});
