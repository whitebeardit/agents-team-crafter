import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const listQuery = z.object({
  type: z.enum(['document', 'database', 'api', 'website']).optional(),
  status: z.enum(['active', 'inactive', 'syncing']).optional(),
});

const createBody = z.object({
  name: z.string().min(1),
  type: z.enum(['document', 'database', 'api', 'website']),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const updateBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export async function registerKnowledgeRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/knowledge-sources', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuery.parse(req.query);
    const data = await deps.knowledgeSourceRepo.list(ws, q);
    return reply.send(successEnvelope(data));
  });

  app.get('/knowledge-sources/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.knowledgeSourceRepo.findById(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Fonte nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/knowledge-sources', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createBody.parse(req.body);
    const data = await deps.knowledgeSourceRepo.create(ws, body);
    return reply.code(201).send(successEnvelope(data));
  });

  app.put('/knowledge-sources/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateBody.parse(req.body);
    const data = await deps.knowledgeSourceRepo.update(ws, id, body);
    if (!data) throw new AppError('NOT_FOUND', 'Fonte nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.delete('/knowledge-sources/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const ok = await deps.knowledgeSourceRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Fonte nao encontrada', 404);
    return reply.send(successEnvelope({ message: 'Fonte de conhecimento removida com sucesso' }));
  });

  app.post('/knowledge-sources/:id/sync', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.knowledgeSourceRepo.startSync(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Fonte nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });
}
