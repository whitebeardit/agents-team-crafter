import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const listQuery = z.object({
  status: z.enum(['connected', 'disconnected', 'pending']).optional(),
  search: z.string().optional(),
});

const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const updateBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export async function registerMcpRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/mcps', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuery.parse(req.query);
    const data = await deps.mcpRepo.list(ws, q);
    return reply.send(successEnvelope(data));
  });

  app.get('/mcps/:id/tools', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const doc = await deps.mcpRepo.findById(ws, id, false);
    if (!doc) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    return reply.send(successEnvelope((doc as { tools: unknown }).tools ?? []));
  });

  app.get('/mcps/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.mcpRepo.findById(ws, id, true);
    if (!data) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/mcps', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createBody.parse(req.body);
    const data = await deps.mcpRepo.create(ws, body);
    return reply.code(201).send(successEnvelope(data));
  });

  app.put('/mcps/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateBody.parse(req.body);
    const data = await deps.mcpRepo.update(ws, id, body);
    if (!data) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.delete('/mcps/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const ok = await deps.mcpRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    return reply.send(successEnvelope({ message: 'Conexao MCP removida com sucesso' }));
  });

  app.post('/mcps/:id/connect', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const exists = await deps.mcpRepo.findById(ws, id, false);
    if (!exists) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    const data = await deps.mcpRepo.connect(ws, id);
    return reply.send(successEnvelope(data));
  });

  app.post('/mcps/:id/disconnect', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.mcpRepo.disconnect(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/mcps/:id/sync-tools', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const exists = await deps.mcpRepo.findById(ws, id, false);
    if (!exists) throw new AppError('NOT_FOUND', 'MCP nao encontrado', 404);
    const data = await deps.mcpRepo.syncTools(ws, id);
    return reply.send(successEnvelope(data));
  });
}
