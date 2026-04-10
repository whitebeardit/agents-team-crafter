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
}
