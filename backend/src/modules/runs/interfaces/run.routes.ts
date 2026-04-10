import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const listQuerySchema = z.object({
  teamId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export async function registerRunRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/runs', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuerySchema.parse(req.query);
    const runs = await deps.runRepo.listRuns(ws, { teamId: q.teamId, limit: q.limit });
    return reply.send(successEnvelope(runs));
  });

  app.get('/runs/:runId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const runId = (req.params as { runId: string }).runId;
    const run = await deps.runRepo.findRun(ws, runId);
    if (!run) throw new AppError('NOT_FOUND', 'Run nao encontrada', 404);
    const steps = await deps.runRepo.listSteps(ws, runId);
    return reply.send(successEnvelope({ ...run, steps }));
  });

  app.get('/runs/:runId/events', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const runId = (req.params as { runId: string }).runId;
    const run = await deps.runRepo.findRun(ws, runId);
    if (!run) throw new AppError('NOT_FOUND', 'Run nao encontrada', 404);
    const events = await deps.runRepo.listEvents(ws, runId);
    return reply.send(successEnvelope(events));
  });

  app.get('/teams/:id/runs', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const runs = await deps.runRepo.listRuns(ws, { teamId, limit: 30 });
    return reply.send(successEnvelope(runs));
  });
}
