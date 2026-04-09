import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';

const agentDomainSchema = z
  .object({
    summary: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    inputDescription: z.string().optional(),
    outputDescription: z.string().optional(),
    boundaries: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
  })
  .optional();

const reviewSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  role: z.enum(['coordinator', 'specialist']),
  category: z.string().optional(),
  skills: z.array(z.string()).optional(),
  goal: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  domain: agentDomainSchema,
  qualityCriteria: z.array(z.string()).optional(),
  reuseHints: z.array(z.string()).optional(),
  platformManaged: z.boolean().optional(),
  systemRole: z.enum(['team-crafter', 'agent-crafter', 'domain-guard']).nullable().optional(),
});

export async function registerAgentGovernanceRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.post('/agent-overlap-reviews', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = reviewSchema.parse(req.body);
    const review = await d.domainGuardService.review(ws, {
      ...body,
      category: normalizeAgentCategory(body.category ?? 'geral'),
    });
    const persisted = await d.agentOverlapReviewRepo.create(ws, {
      draftAgent: review.draftAgent,
      matches: review.matches,
      decision: review.decision,
      summary: review.summary,
    });
    return reply.code(201).send(successEnvelope(persisted));
  });

  app.get('/agent-overlap-reviews', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const reviews = await d.agentOverlapReviewRepo.listRecent(ws);
    return reply.send(successEnvelope(reviews));
  });
}
