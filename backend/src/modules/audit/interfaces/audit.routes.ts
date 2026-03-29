import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { requireAdmin } from '../../../config/container.js';

export async function registerAuditRoutes(app: FastifyInstance, d: IAppDeps) {
  const pre = [d.authenticate, d.requireTenant, requireAdmin()];

  app.get('/audit-logs', { preHandler: pre }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await d.auditLogRepo.list(ws, 100);
    return reply.send(successEnvelope(data));
  });
}
