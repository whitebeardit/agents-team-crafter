import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { requireAdmin } from '../../../config/container.js';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: z.enum(['builtin_ref', 'http_webhook', 'mcp_ref']),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = createSchema.partial();

export async function registerToolDefinitionRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/tool-definitions', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await d.workspaceToolDefinitionRepo.list(ws);
    return reply.send(successEnvelope(data));
  });

  app.get('/tool-definitions/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await d.workspaceToolDefinitionRepo.findById(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/tool-definitions', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    try {
      const data = await d.workspaceToolDefinitionRepo.create(ws, body);
      return reply.code(201).send(successEnvelope(data));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'code' in e && (e as { code?: number }).code === 11000;
      if (msg) throw new AppError('VALIDATION_ERROR', 'Slug ja existe neste workspace', 400);
      throw e;
    }
  });

  app.put('/tool-definitions/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateSchema.parse(req.body);
    const data = await d.workspaceToolDefinitionRepo.update(ws, id, body);
    if (!data) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.delete('/tool-definitions/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const ok = await d.workspaceToolDefinitionRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope({ deleted: true }));
  });
}
