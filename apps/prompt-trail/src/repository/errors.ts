export const PROMPT_TRAIL_REPOSITORY_ERROR_CODES = [
  'storage-failure',
  'reference-not-found',
  'reference-unavailable',
  'scope-mismatch',
  'duplicate-context-id',
  'project-mismatch',
  'snapshot-mismatch',
] as const;

export type PromptTrailRepositoryErrorCode =
  (typeof PROMPT_TRAIL_REPOSITORY_ERROR_CODES)[number];

export class PromptTrailRepositoryError extends Error {
  readonly code: PromptTrailRepositoryErrorCode;

  constructor(code: PromptTrailRepositoryErrorCode, message?: string) {
    super(message);

    this.name = 'PromptTrailRepositoryError';
    this.code = code;
  }
}
