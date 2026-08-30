import type { GatewayProvider } from '../gateway/execute-client';
import { callGatewayExecute } from '../gateway/execute-client';
import type { ConversationMessage, Run, UtcDateTimeString } from '../domain';
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
 * Sends a Run's conversation history to the AI Execution Gateway and persists
 * the generated output. When `userMessage` is omitted, this is treated as the
 * Run's first execution and `run.finalPrompt` is sent as the sole user turn
 * (see #311); when supplied, it continues the conversation held in
 * `run.messages`. `GatewayExecuteError` propagates uncaught so callers can
 * present provider-specific error handling (see #305/#309).
 */
export async function executeRun(
  repository: PromptTrailRepository,
  run: Run,
  userMessage?: string,
  options: ExecuteRunOptions = {},
  now: () => UtcDateTimeString = defaultNow,
): Promise<Run> {
  const provider = options.provider ?? 'claude';
  const nextUserMessage: ConversationMessage = {
    role: 'user',
    content: userMessage ?? run.finalPrompt,
  };
  const historyToSend = [...run.messages, nextUserMessage];
  const output = await callGatewayExecute(historyToSend, provider, {
    model: options.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });
  const updatedMessages: readonly ConversationMessage[] = [
    ...historyToSend,
    { role: 'assistant', content: output },
  ];
  const updatedRun: Run = {
    ...run,
    messages: updatedMessages,
    output,
    updatedAt: now(),
  };
  return repository.saveRun(updatedRun);
}
