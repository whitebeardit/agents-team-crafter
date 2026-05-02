import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PassThrough } from 'node:stream';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { applyCorsHeaders } from '../../../shared/kernel/cors-headers.js';
import { TeamPlanRepository } from '../infra/team-plan.repository.js';
import { TeamPlanService } from '../application/team-plan.service.js';

const createSchema = z.object({
  problem: z.string().min(10),
  context: z.string().optional(),
  briefing: z
    .object({
      problemSummary: z.string().optional(),
      businessType: z.string().optional(),
      operationalUnit: z.string().optional(),
      businessGoal: z.string().optional(),
      coreJourney: z.string().optional(),
      primaryDomain: z.string().optional(),
      secondaryDomains: z.array(z.string()).optional(),
      domainsNeeded: z.array(z.string()).optional(),
      mainEntities: z.array(z.string()).optional(),
      sharedEntities: z.array(z.string()).optional(),
      primaryChannel: z.string().optional(),
      operationKinds: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
      mustHaveCapabilities: z.array(z.string()).optional(),
      mustAvoid: z.array(z.string()).optional(),
      crossDomainIntegrityNeeds: z.array(z.string()).optional(),
    })
    .optional(),
});

const updateSchema = z.object({
  team: z.unknown().optional(),
  agents: z.unknown().optional(),
  graph: z.unknown().optional(),
  bindOverrides: z.unknown().optional(),
});

const executeSchema = z.object({
  operationId: z.string().min(8).optional(),
});

const bindOverridesSchema = z.object({
  bindOverrides: z.unknown().optional(),
});

const bindEnableDefinitionsSchema = z.object({
  actionIds: z.array(z.string().min(1)).min(1),
});

export async function registerTeamPlanRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];
  const repo = new TeamPlanRepository();
  const service = new TeamPlanService(deps, repo);

  app.post('/team-plans', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    const plan = await service.createPlan(ws, body);
    return reply.code(201).send(successEnvelope(plan));
  });

  /** Importa snapshot JSON exportado (sem planner); cria novo plano no workspace. */
  app.post('/team-plans/import', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const plan = await service.importPlanFromSnapshot(ws, req.body);
    return reply.code(201).send(successEnvelope(plan));
  });

  /** Cria o plano e executa materialização (agentes, bind, time) numa única chamada HTTP. */
  app.post('/team-plans/create-and-execute', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    const { plan, responseMeta } = await service.createPlanAndExecute(ws, body, {
      actorUserId: req.user!.sub,
      correlationId: req.requestId,
    });
    return reply.code(201).send(successEnvelope(plan, responseMeta));
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

  app.put('/team-plans/:id/bind-overrides', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = bindOverridesSchema.parse(req.body ?? {});
    const data = await service.updateBindOverrides(ws, id, body.bindOverrides);
    return reply.send(successEnvelope(data));
  });

  app.get('/team-plans/:id/bind-preview', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const preview = await service.previewBind(ws, id);
    return reply.send(successEnvelope(preview));
  });

  app.post('/team-plans/:id/bind-enable-definitions', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = bindEnableDefinitionsSchema.parse(req.body ?? {});
    const data = await service.enableDisabledBindDefinitions(ws, id, body.actionIds);
    return reply.send(
      successEnvelope(data, {
        reactivatedToolDefinitionIds: data.reactivatedToolDefinitionIds,
      }),
    );
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
      'X-Accel-Buffering': 'no',
    });
    applyCorsHeaders(req, reply, deps.env);
    reply.raw.flushHeaders();

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
        const details = err instanceof AppError ? err.details : {};
        writeSse('error', { code, message, status, details });
      } finally {
        stream.end();
      }
    })();

    return reply.send(stream);
  });
}
