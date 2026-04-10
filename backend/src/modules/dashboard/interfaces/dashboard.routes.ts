import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';

export async function registerDashboardRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/dashboard/metrics', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await deps.dashboardRepo.metrics(ws);
    return reply.send(successEnvelope(data));
  });

  app.get('/dashboard/recent-teams', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await deps.dashboardRepo.recentTeams(ws);
    return reply.send(successEnvelope(data));
  });

  app.get('/dashboard/alerts', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await deps.dashboardRepo.alerts(ws);
    return reply.send(successEnvelope(data));
  });
}
