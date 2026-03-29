import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { AuditLogRepository } from '../../modules/audit/infra/audit-log.repository.js';

export interface IObservabilityOpts {
  auditLogRepo: AuditLogRepository;
}

function registerObservability(app: FastifyInstance, auditLogRepo: AuditLogRepository) {
  app.addHook('onRequest', async (req) => {
    (req as { _startedAt?: number })._startedAt = Date.now();
  });

  app.addHook('onResponse', async (req, reply) => {
    const started = (req as { _startedAt?: number })._startedAt;
    const durationMs = started ? Date.now() - started : 0;
    const path = req.url.split('?')[0] ?? req.url;
    req.log.info(
      {
        requestId: req.requestId,
        userId: req.user?.sub,
        workspaceId: req.workspaceId,
        method: req.method,
        path,
        statusCode: reply.statusCode,
        durationMs,
      },
      'http_request',
    );

    if (!path.startsWith('/api/v1')) return;
    if (!req.workspaceId || !req.user?.sub) return;
    const mut = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    if (!mut) return;

    const appendPromise = auditLogRepo.append({
      workspaceId: req.workspaceId,
      userId: req.user.sub,
      method: req.method,
      path,
      statusCode: reply.statusCode,
      durationMs,
      correlationId: req.requestId,
    });
    if (process.env.NODE_ENV === 'test') await appendPromise;
  });
}

const observabilityPlugin: FastifyPluginAsync<IObservabilityOpts> = async (app, opts) => {
  registerObservability(app, opts.auditLogRepo);
};

export default fp(observabilityPlugin, { name: 'observability' });
