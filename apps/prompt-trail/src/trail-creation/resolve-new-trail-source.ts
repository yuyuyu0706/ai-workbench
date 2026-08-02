export type NewTrailSource =
  | { readonly kind: 'blank' }
  | { readonly kind: 'run'; readonly runId: string }
  | { readonly kind: 'prompt'; readonly promptId: string }
  | { readonly kind: 'invalid' };

export function resolveNewTrailSource(
  searchParams: URLSearchParams,
): NewTrailSource {
  const runIds = searchParams.getAll('sourceRunId');
  const promptIds = searchParams.getAll('sourcePromptId');
  if (runIds.length === 0 && promptIds.length === 0) return { kind: 'blank' };
  if (
    runIds.length > 1 ||
    promptIds.length > 1 ||
    (runIds.length > 0 && promptIds.length > 0)
  )
    return { kind: 'invalid' };
  if (runIds.length === 1) {
    const runId = runIds[0]!.trim();
    return runId.length > 0 ? { kind: 'run', runId } : { kind: 'invalid' };
  }
  const promptId = promptIds[0]!.trim();
  return promptId.length > 0
    ? { kind: 'prompt', promptId }
    : { kind: 'invalid' };
}
