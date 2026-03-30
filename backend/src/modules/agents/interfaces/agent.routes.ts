import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { paginationQuerySchema, paginationMeta } from '../../../shared/kernel/pagination.js';
import {
  missionSchema,
  knowledgeSchema,
  toolsSchema,
  channelsCfgSchema,
  securitySchema,
} from '../application/agent-config.schemas.js';

const listQuerySchema = paginationQuerySchema.merge(
  z.object({
    origin: z.enum(['whitebeard', 'company']).optional(),
    category: z.string().optional(),
    channel: z.string().optional(),
    role: z.enum(['coordinator', 'specialist']).optional(),
    search: z.string().optional(),
  }),
);

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  role: z.enum(['coordinator', 'specialist']),
  skills: z.array(z.string()).default([]),
  category: z.string().optional(),
  channels: z.array(z.enum(['whatsapp', 'slack', 'email', 'api'])).default([]),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
  category: z.string().optional(),
  channels: z.array(z.enum(['whatsapp', 'slack', 'email', 'api'])).optional(),
});

function asRec(a: unknown): Record<string, unknown> {
  return a as Record<string, unknown>;
}

async function loadAgent(d: IAppDeps, ws: string, id: string) {
  const a = await d.agentRepo.findById(ws, id);
  if (!a) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);
  return asRec(a);
}

function assertCompany(a: Record<string, unknown>) {
  if (a['origin'] === 'whitebeard') {
    throw new AppError('FORBIDDEN', 'Agente catalogo somente leitura', 403);
  }
}

function assertCoordinatorForChannels(a: Record<string, unknown>) {
  if (a['role'] !== 'coordinator') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Apenas agentes coordenadores podem ter configuracao de canais persistida.',
      400,
    );
  }
}

export async function registerAgentRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/agents/categories', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const cats = await d.agentRepo.distinctCategories(ws);
    return reply.send(successEnvelope(cats));
  });

  app.get('/agents', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuerySchema.parse(req.query);
    const { items, total } = await d.agentRepo.list(
      ws,
      {
        origin: q.origin,
        category: q.category,
        channel: q.channel,
        role: q.role,
        search: q.search,
      },
      q.page,
      q.perPage,
    );
    return reply.send(successEnvelope(items, paginationMeta(q.page, q.perPage, total)));
  });

  app.post('/agents', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createAgentSchema.parse(req.body);
    if (body.role === 'specialist' && body.channels.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Especialistas nao podem ter lista de canais na criacao; apenas coordenadores configuram canais.',
        400,
      );
    }
    const created = await d.agentRepo.create(ws, {
      name: body.name,
      description: body.description ?? '',
      role: body.role,
      origin: 'company',
      skills: body.skills,
      category: body.category ?? 'Geral',
      channels: body.channels,
      status: 'active',
      version: '1.0.0',
    });
    return reply.code(201).send(successEnvelope(created));
  });

  app.get('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const a = await loadAgent(d, ws, id);
    return reply.send(successEnvelope(a));
  });

  app.put('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = updateAgentSchema.parse(req.body);
    if (body.channels !== undefined && cur['role'] !== 'coordinator') {
      assertCoordinatorForChannels(cur);
    }
    const updated = await d.agentRepo.update(ws, id, body);
    return reply.send(successEnvelope(updated));
  });

  app.delete('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const teams = await d.teamRepo.findTeamsReferencingAgent(ws, id);
    if (teams.length > 0) {
      const hasCoord = teams.some((t) => t.asCoordinator);
      const hasMember = teams.some((t) => !t.asCoordinator);
      let msg = 'Agente vinculado a um ou mais times; ';
      if (hasCoord && hasMember) {
        msg += 'transfira a funcao de coordenador e remova o agente dos times antes de excluir';
      } else if (hasCoord) {
        msg += 'transfira a funcao de coordenador antes de excluir';
      } else {
        msg += 'remova o agente dos times antes de excluir';
      }
      throw new AppError('CONFLICT', msg, 409, { teams });
    }
    await d.agentRepo.softDelete(ws, id);
    return reply.send(successEnvelope({ message: 'Agente removido com sucesso' }));
  });

  app.post('/agents/:id/archive', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const updated = await d.agentRepo.update(ws, id, { status: 'archived' });
    return reply.send(
      successEnvelope({
        id,
        status: 'archived',
        archivedAt: new Date().toISOString(),
        ...(updated as object),
      }),
    );
  });

  app.post('/agents/:id/activate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    await d.agentRepo.update(ws, id, { status: 'active' });
    return reply.send(
      successEnvelope({
        id,
        status: 'active',
        activatedAt: new Date().toISOString(),
      }),
    );
  });

  app.get('/agents/:id/config', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const a = await loadAgent(d, ws, id);
    return reply.send(
      successEnvelope({
        id: a['id'],
        name: a['name'],
        description: a['description'],
        role: a['role'],
        origin: a['origin'],
        status: a['status'],
        goal: a['goal'],
        responsibilities: a['responsibilities'],
        systemInstruction: a['systemInstruction'],
        capabilities: a['capabilities'],
        knowledge: a['knowledge'],
        channelConfig: a['channelConfig'],
        security: a['security'],
      }),
    );
  });

  app.put('/agents/:id/config', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = z.record(z.string(), z.unknown()).parse(req.body);
    delete body['handoff'];
    await d.agentRepo.update(ws, id, body);
    return reply.send(
      successEnvelope({
        message: 'Configuracao do agente atualizada com sucesso',
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  app.put('/agents/:id/mission', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = missionSchema.parse(req.body);
    await d.agentRepo.update(ws, id, body);
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/knowledge', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = knowledgeSchema.parse(req.body);
    await d.agentRepo.update(ws, id, { knowledge: body });
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/tools', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = toolsSchema.parse(req.body);
    const cap = { ...(asRec(cur)['capabilities'] as Record<string, unknown> | undefined) };
    delete cap['canDelegate'];
    delete cap['canReceiveHandoff'];
    await d.agentRepo.update(ws, id, {
      capabilities: {
        ...cap,
        tools: body.tools,
      },
    });
    return reply.send(successEnvelope({ tools: body.tools }));
  });

  app.put('/agents/:id/channels', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    assertCoordinatorForChannels(cur);
    const body = channelsCfgSchema.parse(req.body);
    await d.agentRepo.update(ws, id, { channelConfig: body });
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/security', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(d, ws, id);
    assertCompany(cur);
    const body = securitySchema.parse(req.body);
    await d.agentRepo.update(ws, id, { security: body });
    return reply.send(successEnvelope(body));
  });

}
