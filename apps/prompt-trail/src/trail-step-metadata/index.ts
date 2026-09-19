import { TRAIL_STEP_KINDS, type TrailStepKind } from '../domain';

export const TRAIL_STEP_TITLE_MAX_LENGTH = 80;

export const TRAIL_STEP_KIND_LABELS: Readonly<Record<TrailStepKind, string>> = {
  prompt: 'Promptを実行する工程',
  manual: '人手の工程',
};

export type TrailStepMetadata = {
  readonly title: string;
  readonly kind: unknown;
  readonly promptId: string | null;
};

export type TrailStepMetadataError =
  | 'step-title-required'
  | 'step-title-too-long'
  | 'step-title-newline'
  | 'step-kind-invalid'
  | 'step-prompt-id-required'
  | 'step-prompt-id-not-allowed';

export function isTrailStepKind(value: unknown): value is TrailStepKind {
  return (
    typeof value === 'string' && TRAIL_STEP_KINDS.some((kind) => kind === value)
  );
}

export function normalizeTrailStepTitle(value: string): string {
  return value.trim();
}

export function validateTrailStepMetadata(input: {
  readonly title: string;
  readonly kind: unknown;
  readonly promptId: string | null;
}): readonly TrailStepMetadataError[] {
  const title = normalizeTrailStepTitle(input.title);
  const errors: TrailStepMetadataError[] = [];
  if (title.length === 0) errors.push('step-title-required');
  if (title.length > TRAIL_STEP_TITLE_MAX_LENGTH)
    errors.push('step-title-too-long');
  if (/\r|\n/.test(input.title)) errors.push('step-title-newline');
  if (!isTrailStepKind(input.kind)) {
    errors.push('step-kind-invalid');
  } else if (input.kind === 'prompt' && input.promptId === null) {
    errors.push('step-prompt-id-required');
  } else if (input.kind === 'manual' && input.promptId !== null) {
    errors.push('step-prompt-id-not-allowed');
  }
  return errors;
}
