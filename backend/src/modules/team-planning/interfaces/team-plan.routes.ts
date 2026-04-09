import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PassThrough } from 'node:stream';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { TeamPlanRepository } from '../infra/team-plan.repository.js';
import { TeamPlanService } from '../application/team-plan.service.js';

const createSchema = z.object({
  problem: z.string().min(10),
  context: z.string().optional(),
});

const updateSchema = z.object({
  team: z.unknown().optional(),
  agents: z.unknown().optional(),
  graph: z.unknown().optional(),
});

const executeSchema = z.object({
  operationId: z.string().min(8).optional(),
});

export async function registerTeamPlanRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];
  const repo = new TeamPlanRepository();
  const service = new TeamPlanService(d, repo);

  app.post('/team-plans', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    const plan = await service.createPlan(ws, body);
    return reply.code(201).send(successEnvelope(plan));
  });

  app.get('/team-plans/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const plan = await repo.findById(ws, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    return reply.send(successEnvelope(plan));
  });

  app.put('/team-plans/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateSchema.parse(req.body);
    const plan = await service.updatePlan(ws, id, body);
    return reply.send(successEnvelope(plan));
  });

  app.post('/team-plans/:id/execute', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = executeSchema.parse(req.body ?? {});
    const { plan, responseMeta } = await service.executePlan(ws, id, body.operationId, {
      actorUserId: req.user!.sub,
      correlationId: req.requestId,
    });
    return reply.send(successEnvelope(plan, responseMeta));
  });

  /**
   * SSE: progress por fase + complete com o plano executado.
   * Body: { operationId?: string }
   */
  app.post('/team-plans/:id/execute/stream', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = executeSchema.parse(req.body ?? {});

    const stream = new PassThrough();
    reply.headers({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeSse = (event: string, data: unknown) => {
      stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    void (async () => {
      try {
        const { plan, responseMeta } = await service.executePlan(ws, id, body.operationId, {
          onPhase: (phase, detail) => writeSse('phase', { phase, detail }),
          actorUserId: req.user!.sub,
          correlationId: req.requestId,
        });
        writeSse('complete', { data: plan, meta: responseMeta });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
        const status = err instanceof AppError ? err.httpStatus : 500;
        writeSse('error', { code, message, status });
      } finally {
        stream.end();
      }
    })();

    return reply.send(stream);
  });
}
