import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const createBinding = z.object({
  mcpConnectionId: z.string().min(1),
  allowedTools: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
});

const updateBinding = z
  .object({
    allowedTools: z.array(z.string()).optional(),
    requiresApproval: z.boolean().optional(),
  })
  .refine((b) => b.allowedTools !== undefined || b.requiresApproval !== undefined, {
    message: 'Informe allowedTools ou requiresApproval',
  });

export async function registerAgentMcpBindingRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/agents/:id/mcp-bindings', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const agentId = (req.params as { id: string }).id;
    const agent = await d.agentRepo.findById(ws, agentId);
    if (!agent) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);
    const data = await d.agentMcpBindingRepo.listByAgent(ws, agentId);
    return reply.send(successEnvelope(data));
  });

  app.post('/agents/:id/mcp-bindings', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const agentId = (req.params as { id: string }).id;
    const cur = await d.agentRepo.findById(ws, agentId);
    if (!cur) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);
    if ((cur as { origin?: string }).origin === 'whitebeard') {
      throw new AppError('FORBIDDEN', 'Agente catalogo somente leitura', 403);
    }
    const body = createBinding.parse(req.body);
    const mcpExists = await d.mcpRepo.findById(ws, body.mcpConnectionId, false);
    if (!mcpExists) throw new AppError('VALIDATION_ERROR', 'MCP invalido', 400);
    const result = await d.agentMcpBindingRepo.create(ws, agentId, body);
    if ('error' in result) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Ferramenta nao disponivel no MCP: ${result.tool}`,
        400,
      );
    }
    return reply.code(201).send(successEnvelope(result.data));
  });

  app.put('/agents/:id/mcp-bindings/:bindingId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const agentId = (req.params as { id: string }).id;
    const bindingId = (req.params as { bindingId: string }).bindingId;
    const cur = await d.agentRepo.findById(ws, agentId);
    if (!cur) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);
    if ((cur as { origin?: string }).origin === 'whitebeard') {
      throw new AppError('FORBIDDEN', 'Agente catalogo somente leitura', 403);
    }
    const body = updateBinding.parse(req.body);
    const result = await d.agentMcpBindingRepo.update(ws, agentId, bindingId, body);
    if (!result) throw new AppError('NOT_FOUND', 'Vinculo nao encontrado', 404);
    if ('error' in result) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Ferramenta nao disponivel no MCP: ${result.tool}`,
        400,
      );
    }
    return reply.send(successEnvelope(result.data));
  });

  app.delete('/agents/:id/mcp-bindings/:bindingId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const agentId = (req.params as { id: string }).id;
    const bindingId = (req.params as { bindingId: string }).bindingId;
    const cur = await d.agentRepo.findById(ws, agentId);
    if (!cur) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);
    if ((cur as { origin?: string }).origin === 'whitebeard') {
      throw new AppError('FORBIDDEN', 'Agente catalogo somente leitura', 403);
    }
    const ok = await d.agentMcpBindingRepo.delete(ws, agentId, bindingId);
    if (!ok) throw new AppError('NOT_FOUND', 'Vinculo nao encontrado', 404);
    return reply.send(successEnvelope({ message: 'Vinculo MCP removido com sucesso' }));
  });
}
