import type { GatewayProvider } from '../gateway/execute-client';
import { callGatewayExecute } from '../gateway/execute-client';
import type { Run, UtcDateTimeString } from '../domain';
import type { PromptTrailRepository } from '../repository';

export type ExecuteRunOptions = {
  readonly provider?: GatewayProvider;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
};

export function defaultNow(): UtcDateTimeString {
  return new Date().toISOString() as UtcDateTimeString;
}

/**
 * Sends a Run's prompt snapshot to the AI Execution Gateway and persists the
 * generated output. `GatewayExecuteError` propagates uncaught so callers can
 * present provider-specific error handling (see #305/#309).
 */
export async function executeRun(
  repository: PromptTrailRepository,
  run: Run,
  options: ExecuteRunOptions = {},
  now: () => UtcDateTimeString = defaultNow,
): Promise<Run> {
  const provider = options.provider ?? 'claude';
  const output = await callGatewayExecute(run.promptSnapshot.body, provider, {
    model: options.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });
  const updatedRun: Run = { ...run, output, updatedAt: now() };
  return repository.saveRun(updatedRun);
}
