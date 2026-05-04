import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { AgentPlanRepository } from '../infra/agent-plan.repository.js';
import { AgentPlanService } from '../application/agent-plan.service.js';
import { agentDomainSchema } from '../../agents/application/agent-config.schemas.js';

const createSchema = z.object({
  objective: z.string().min(10),
  context: z.string().optional(),
  expectedOutcome: z.string().optional(),
  role: z.enum(['coordinator', 'specialist']).optional(),
  category: z.string().optional(),
  skills: z.array(z.string()).optional(),
  boundaries: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  request: z.record(z.string(), z.unknown()).optional(),
  draftAgent: z
    .object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      role: z.enum(['coordinator', 'specialist']),
      category: z.string().optional(),
      skills: z.array(z.string()).optional(),
      goal: z.string().optional(),
      responsibilities: z.array(z.string()).optional(),
      domain: agentDomainSchema.optional(),
      qualityCriteria: z.array(z.string()).optional(),
      reuseHints: z.array(z.string()).optional(),
      platformManaged: z.boolean().optional(),
      systemRole: z.enum(['team-crafter', 'agent-crafter', 'domain-guard', 'librarian']).nullable().optional(),
    })
    .optional(),
});

export async function registerAgentPlanRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];
  const repo = new AgentPlanRepository();
  const service = new AgentPlanService(deps, repo);

  app.post('/agent-plans', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    const created = await service.createPlan(ws, body);
    return reply.code(201).send(successEnvelope(created));
  });

  app.get('/agent-plans/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const plan = await repo.findById(ws, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
    return reply.send(successEnvelope(plan));
  });

  app.put('/agent-plans/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateSchema.parse(req.body);
    const updated = await service.updatePlan(ws, id, body);
    return reply.send(successEnvelope(updated));
  });

  app.post('/agent-plans/:id/execute', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const { plan, responseMeta } = await service.executePlan(ws, id, {
      actorUserId: req.user!.sub,
      correlationId: req.requestId,
    });
    return reply.send(successEnvelope(plan, responseMeta));
  });
}
