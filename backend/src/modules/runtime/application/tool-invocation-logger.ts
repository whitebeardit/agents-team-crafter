import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export function logToolInvocation(entry: {
  workspaceId: string;
  tool: string;
  ok: boolean;
  correlationId?: string;
  detail?: Record<string, unknown>;
}): void {
  logger.info(
    {
      kind: 'tool_invocation',
      workspaceId: entry.workspaceId,
      tool: entry.tool,
      ok: entry.ok,
      correlationId: entry.correlationId,
      ...entry.detail,
    },
    'tool_invocation',
  );
}
