/**
 * Thrown when an Agent Execution API call
 * (`POST /api/agent-dispatch` or `GET /api/agent-status`) fails. Shaped like
 * `GatewayExecuteError` (see `src/gateway/execute-client.ts`): it preserves
 * the HTTP status and the response's `error` message so callers can present
 * API-specific error handling.
 */
export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}
