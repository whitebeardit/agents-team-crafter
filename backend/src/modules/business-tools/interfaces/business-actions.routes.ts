import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { listDomainCapabilities, resolveDomainCapabilitySelection } from '../application/domain-capability-registry.js';

const resolveDomainsSchema = z.object({
  domainIds: z.array(z.string().min(1)).min(1).max(32),
});

/**
 * Catálogo read-only de ações internas registadas (para UI de tool definitions).
 */
export async function registerBusinessActionRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/business-actions/catalog', { preHandler: tenant }, async (_req, reply) => {
    const data = deps.businessToolRegistry.listCatalog();
    return reply.send(successEnvelope(data));
  });

  app.get('/business-actions/domains', { preHandler: tenant }, async (_req, reply) => {
    const registeredActionIds = new Set(deps.businessToolRegistry.listCatalog().map((item) => item.actionId));
    const data = listDomainCapabilities().map((domain) => {
      const availableActionIds = domain.actionIds.filter((actionId) => registeredActionIds.has(actionId));
      const unavailableActionIds = domain.actionIds.filter((actionId) => !registeredActionIds.has(actionId));
      return {
        ...domain,
        availableActionIds,
        unavailableActionIds,
        availableActionCount: availableActionIds.length,
      };
    });
    return reply.send(successEnvelope(data));
  });

  app.post('/business-actions/domains/resolve', { preHandler: tenant }, async (req, reply) => {
    const body = resolveDomainsSchema.parse(req.body ?? {});
    const resolution = resolveDomainCapabilitySelection(body.domainIds);
    const registeredActionIds = new Set(deps.businessToolRegistry.listCatalog().map((item) => item.actionId));
    const availableActionIds = resolution.actionIds.filter((actionId) => registeredActionIds.has(actionId));
    const unavailableActionIds = resolution.actionIds.filter((actionId) => !registeredActionIds.has(actionId));
    return reply.send(
      successEnvelope({
        ...resolution,
        actionIds: availableActionIds,
        unavailableActionIds,
      }),
    );
  });
}
