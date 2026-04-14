import type { BusinessToolRegistry } from './business-tool-registry.js';

/**
 * Built-in internal actions shipped with the platform (Loop 17+).
 * Domain packs register additional handlers via their own modules.
 */
export function registerCoreBusinessActions(registry: BusinessToolRegistry): void {
  registry.register('business.ping', async ({ workspaceId, input }) => {
    const msg =
      input &&
      typeof input === 'object' &&
      input !== null &&
      'message' in input &&
      typeof (input as { message: unknown }).message === 'string'
        ? (input as { message: string }).message
      : 'pong';
    return { ok: true, workspaceId, echo: msg };
  });

  registry.register('platform_status_overview', async ({ workspaceId, input }) => {
    const includeTimestamp =
      input &&
      typeof input === 'object' &&
      input !== null &&
      'includeTimestamp' in input &&
      Boolean((input as { includeTimestamp?: unknown }).includeTimestamp);

    return {
      ok: true,
      workspaceId,
      status: 'operational',
      ...(includeTimestamp ? { timestamp: new Date().toISOString() } : {}),
    };
  });
}
