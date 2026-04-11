import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';

/**
 * Catálogo read-only de ações internas registadas (para UI de tool definitions).
 */
export async function registerBusinessActionRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/business-actions/catalog', { preHandler: tenant }, async (_req, reply) => {
    const data = deps.businessToolRegistry.listCatalog();
    return reply.send(successEnvelope(data));
  });
}
