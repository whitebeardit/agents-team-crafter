import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const listQuery = z.object({
  origin: z.enum(['whitebeard', 'company']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

const applyBody = z.object({
  teamName: z.string().min(1),
  teamDescription: z.string().optional(),
  channelIds: z.array(z.string()).default([]),
});

const saveBody = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('Geral'),
});

export async function registerTemplateRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/templates', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuery.parse(req.query);
    const data = await d.templateRepo.list(ws, q);
    return reply.send(successEnvelope(data));
  });

  app.get('/templates/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await d.templateRepo.findById(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/templates/:id/apply', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = applyBody.parse(req.body);
    const chOk = await d.channelRepo.existsAll(ws, body.channelIds);
    if (!chOk) throw new AppError('VALIDATION_ERROR', 'Canal invalido', 400);
    const result = await d.templateRepo.apply(ws, id, body);
    if (!result) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.code(201).send(successEnvelope(result));
  });

  app.post('/templates', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = saveBody.parse(req.body);
    const created = await d.templateRepo.saveFromTeam(ws, body);
    if (!created) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.code(201).send(successEnvelope(created));
  });

  app.delete('/templates/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const tpl = await d.templateRepo.findById(ws, id);
    if (!tpl) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    if (tpl.origin === 'whitebeard') {
      throw new AppError('FORBIDDEN', 'Template catalogo somente leitura', 403);
    }
    const ok = await d.templateRepo.deleteCompany(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.send(successEnvelope({ message: 'Template removido com sucesso' }));
  });
}
