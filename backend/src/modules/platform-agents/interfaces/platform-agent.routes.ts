import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { PLATFORM_AGENT_TEAM_CATALOG } from '../domain/platform-agent-team-catalog.js';

export async function registerPlatformAgentRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/platform/agent-teams/catalog', { preHandler: tenant }, async (_req, reply) => {
    return reply.send(successEnvelope(PLATFORM_AGENT_TEAM_CATALOG));
  });
}
