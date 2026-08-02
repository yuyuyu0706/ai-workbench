import { TRAIL_KINDS, type TrailKind } from '../domain';

export const TRAIL_TITLE_MAX_LENGTH = 80;

export const TRAIL_KIND_LABELS: Readonly<Record<TrailKind, string>> = {
  'planning-design': '企画・設計',
  development: '開発',
  research: '調査',
  review: 'レビュー',
  'incident-response': '障害対応',
  other: 'その他',
};

export type TrailMetadata = {
  readonly trailTitle: string;
  readonly trailKind: TrailKind;
};

export type TrailMetadataError =
  | 'trail-title-required'
  | 'trail-title-too-long'
  | 'trail-title-newline'
  | 'trail-kind-invalid';

export function isTrailKind(value: unknown): value is TrailKind {
  return (
    typeof value === 'string' && TRAIL_KINDS.some((kind) => kind === value)
  );
}

export function normalizeTrailTitle(value: string): string {
  return value.trim();
}

export function validateTrailMetadata(input: {
  readonly trailTitle: string;
  readonly trailKind: unknown;
}): readonly TrailMetadataError[] {
  const title = normalizeTrailTitle(input.trailTitle);
  const errors: TrailMetadataError[] = [];
  if (title.length === 0) errors.push('trail-title-required');
  if (title.length > TRAIL_TITLE_MAX_LENGTH)
    errors.push('trail-title-too-long');
  if (/\r|\n/.test(input.trailTitle)) errors.push('trail-title-newline');
  if (!isTrailKind(input.trailKind)) errors.push('trail-kind-invalid');
  return errors;
}
