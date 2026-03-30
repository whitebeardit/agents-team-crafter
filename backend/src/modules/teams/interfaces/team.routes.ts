import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { paginationQuerySchema, paginationMeta } from '../../../shared/kernel/pagination.js';
import { validateTeamGraph } from '../../graphs/domain/graph-validator.js';
import type { IGraphNode } from '../../graphs/domain/graph-types.js';
import {
  enrichTeamGraphPayload,
  normalizeGraphNodesEntityFields,
  normalizePersistedChannelEdgesToCoordinator,
  stripDerivedGraphEdges,
} from '../../graphs/domain/graph-enrichment.js';
import { assertActiveChannelBindingUnique } from '../application/assert-active-channel-binding.js';
import { invokeTeam } from '../../team-runtime/application/invoke-team.service.js';
import {
  buildManualTeamInvocation,
  teamRunBodySchema,
} from '../../team-runtime/infra/registries/trigger-mapper-registry.js';

const listTeamsQuery = paginationQuerySchema.merge(
  z.object({
    status: z.enum(['active', 'draft', 'inactive']).optional(),
    search: z.string().optional(),
  }),
);

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  objective: z.string().optional(),
  coordinatorId: z.string().min(1),
  agentIds: z.array(z.string()).default([]),
  channelIds: z.array(z.string()).default([]),
  primaryChannel: z.enum(['whatsapp', 'slack', 'email', 'api']).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'draft', 'inactive']).optional(),
  objective: z.string().optional(),
  coordinatorId: z.string().min(1).optional(),
  agentIds: z.array(z.string()).optional(),
  channelIds: z.array(z.string()).optional(),
  primaryChannel: z.enum(['whatsapp', 'slack', 'email', 'api']).optional(),
});

const duplicateSchema = z.object({
  name: z.string().min(1),
});

const graphBodySchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

async function assertCoordinatorRole(d: IAppDeps, workspaceId: string, agentId: string): Promise<void> {
  const row = await d.agentRepo.findById(workspaceId, agentId);
  if (!row) throw new AppError('VALIDATION_ERROR', 'Coordenador invalido', 400);
  const role = (row as Record<string, unknown>)['role'];
  if (role !== 'coordinator') {
    throw new AppError(
      'VALIDATION_ERROR',
      'O coordenador do time deve ser um agente com funcao Coordenador (role coordinator).',
      400,
    );
  }
}

/** Campos de agente para cards no detalhe do time (versão, skills, canais declarativos, etc.). */
function toTeamAgentDigest(a: Record<string, unknown>) {
  return {
    id: a['id'],
    name: a['name'],
    avatar: a['avatar'],
    role: a['role'],
    version: a['version'],
    description: a['description'],
    category: a['category'],
    skills: (a['skills'] as string[]) ?? [],
    channels: (a['channels'] as string[]) ?? [],
  };
}

export async function registerTeamRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/teams', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listTeamsQuery.parse(req.query);
    const { items, total } = await d.teamRepo.list(
      ws,
      { status: q.status, search: q.search },
      q.page,
      q.perPage,
    );
    return reply.send(successEnvelope(items, paginationMeta(q.page, q.perPage, total)));
  });

  app.post('/teams', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createTeamSchema.parse(req.body);
    const coordOk = await d.agentRepo.existsAll(ws, [body.coordinatorId]);
    if (!coordOk) throw new AppError('VALIDATION_ERROR', 'Coordenador invalido', 400);
    await assertCoordinatorRole(d, ws, body.coordinatorId);
    const agentsOk = await d.agentRepo.existsAll(ws, body.agentIds);
    if (!agentsOk) throw new AppError('VALIDATION_ERROR', 'Agente invalido no time', 400);
    const chOk = await d.channelRepo.existsAll(ws, body.channelIds);
    if (!chOk) throw new AppError('VALIDATION_ERROR', 'Canal invalido no time', 400);
    const created = await d.teamRepo.create(ws, {
      name: body.name,
      description: body.description ?? '',
      objective: body.objective,
      coordinatorId: body.coordinatorId,
      agentIds: body.agentIds,
      channelIds: body.channelIds,
      primaryChannel: body.primaryChannel,
      status: 'draft',
    });
    return reply.code(201).send(successEnvelope(created));
  });

  app.get('/teams/:id/graph', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const g = await d.teamGraphRepo.get(ws, teamId);
    const enrichTeam = {
      coordinatorId: team.coordinatorId,
      agentIds: team.agentIds,
      channelIds: team.channelIds,
    };
    const normalizedNodes = normalizeGraphNodesEntityFields(g.nodes, enrichTeam);
    const workspaceAgentIds = await d.agentRepo.listAllIds(ws);
    const cleanEdges = stripDerivedGraphEdges(g.edges);
    const { edges: persistedFixed, changed } = normalizePersistedChannelEdgesToCoordinator(
      normalizedNodes as IGraphNode[],
      cleanEdges,
      enrichTeam,
      { agentIds: workspaceAgentIds },
    );
    if (changed) {
      await d.teamGraphRepo.upsert(ws, teamId, normalizedNodes, persistedFixed);
    }
    const payload = enrichTeamGraphPayload(normalizedNodes, persistedFixed, enrichTeam);
    return reply.send(successEnvelope({ nodes: payload.nodes, edges: payload.edges }));
  });

  app.put('/teams/:id/graph', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = graphBodySchema.parse(req.body);
    const enrichTeam = {
      coordinatorId: team.coordinatorId,
      agentIds: team.agentIds,
      channelIds: team.channelIds,
    };
    const normalizedNodes = normalizeGraphNodesEntityFields(body.nodes, enrichTeam);
    const cleanEdges = stripDerivedGraphEdges(body.edges);
    const agentIds = await d.agentRepo.listAllIds(ws);
    const channelIds = await d.channelRepo.listAllIds(ws);
    const { edges: edgesToPersist } = normalizePersistedChannelEdgesToCoordinator(
      normalizedNodes as IGraphNode[],
      cleanEdges,
      enrichTeam,
      { agentIds },
    );
    const enrich = { team: enrichTeam };
    const graphValidation = validateTeamGraph(
      normalizedNodes as IGraphNode[],
      edgesToPersist,
      { agentIds, channelIds },
      enrich,
    );
    if (!graphValidation.valid) {
      throw new AppError(
        'VALIDATION_ERROR',
        graphValidation.errors.map((e) => e.message).join(' '),
        400,
      );
    }
    await d.teamGraphRepo.upsert(ws, teamId, normalizedNodes, edgesToPersist);
    return reply.send(
      successEnvelope({
        message: 'Grafo atualizado com sucesso',
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  app.post('/teams/:id/graph/validate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = graphBodySchema.parse(req.body);
    const agentIds = await d.agentRepo.listAllIds(ws);
    const channelIds = await d.channelRepo.listAllIds(ws);
    const enrichTeam = {
      coordinatorId: team.coordinatorId,
      agentIds: team.agentIds,
      channelIds: team.channelIds,
    };
    const normalizedNodes = normalizeGraphNodesEntityFields(body.nodes, enrichTeam) as IGraphNode[];
    const cleanEdges = stripDerivedGraphEdges(body.edges);
    const { edges: edgesToValidate } = normalizePersistedChannelEdgesToCoordinator(
      normalizedNodes,
      cleanEdges,
      enrichTeam,
      { agentIds },
    );
    const enrich = { team: enrichTeam };
    const result = validateTeamGraph(normalizedNodes, edgesToValidate, { agentIds, channelIds }, enrich);
    return reply.send(successEnvelope(result));
  });

  app.get('/teams/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, id);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const t = team as Record<string, unknown>;
    const coordId = String(t['coordinatorId']);
    const agentIds = (t['agentIds'] as string[]) ?? [];
    const channelIds = (t['channelIds'] as string[]) ?? [];
    const coordinator = await d.agentRepo.findById(ws, coordId);
    const agents = [];
    for (const aid of agentIds) {
      const ag = await d.agentRepo.findById(ws, aid);
      if (ag) agents.push(ag);
    }
    const chRows = await d.channelRepo.listByIds(ws, channelIds);
    const channels = chRows.map((c: Record<string, unknown>) => ({
      id: c['_id']!.toString(),
      type: c['type'],
      name: c['name'],
      status: c['status'],
    }));
    return reply.send(
      successEnvelope({
        ...t,
        coordinator: coordinator ? toTeamAgentDigest(coordinator as Record<string, unknown>) : undefined,
        agents: agents.map((a) => toTeamAgentDigest(a as Record<string, unknown>)),
        channels,
        metrics: {
          conversationsToday: 0,
          avgResponseTime: '0m',
          satisfactionRate: 0,
        },
      }),
    );
  });

  app.put('/teams/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateTeamSchema.parse(req.body);
    if (body.coordinatorId) {
      const ok = await d.agentRepo.existsAll(ws, [body.coordinatorId]);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Coordenador invalido', 400);
      await assertCoordinatorRole(d, ws, body.coordinatorId);
    }
    if (body.agentIds) {
      const ok = await d.agentRepo.existsAll(ws, body.agentIds);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Agente invalido', 400);
    }
    if (body.channelIds) {
      const ok = await d.channelRepo.existsAll(ws, body.channelIds);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Canal invalido', 400);
    }
    const current = await d.teamRepo.findById(ws, id);
    if (!current) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const cur = current as Record<string, unknown>;
    const nextStatus = body.status ?? (cur['status'] as string);
    const nextChannelIds = (body.channelIds ?? (cur['channelIds'] as string[])) as string[];
    if (nextStatus === 'active') {
      await assertActiveChannelBindingUnique(d.teamRepo, ws, nextChannelIds, id);
    }
    const updated = await d.teamRepo.update(ws, id, body as Record<string, unknown>);
    if (!updated) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.send(successEnvelope(updated));
  });

  app.delete('/teams/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    await d.teamRepo.delete(ws, id);
    return reply.send(successEnvelope({ message: 'Time removido com sucesso' }));
  });

  app.post('/teams/:id/activate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, id);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const chIds = ((team as Record<string, unknown>)['channelIds'] as string[]) ?? [];
    await assertActiveChannelBindingUnique(d.teamRepo, ws, chIds, id);
    const updated = await d.teamRepo.update(ws, id, { status: 'active' });
    if (!updated) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.send(
      successEnvelope({
        id,
        status: 'active',
        activatedAt: new Date().toISOString(),
      }),
    );
  });

  app.post('/teams/:id/deactivate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const updated = await d.teamRepo.update(ws, id, { status: 'inactive' });
    if (!updated) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.send(
      successEnvelope({
        id,
        status: 'inactive',
        deactivatedAt: new Date().toISOString(),
      }),
    );
  });

  app.post('/teams/:id/duplicate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = duplicateSchema.parse(req.body);
    const dup = await d.teamRepo.duplicate(ws, id, body.name);
    if (!dup) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.code(201).send(successEnvelope(dup));
  });

  app.post('/teams/:id/run', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await d.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = teamRunBodySchema.parse(req.body);
    const t = team as Record<string, unknown>;
    const invocation = buildManualTeamInvocation(ws, String(t['id']), String(t['coordinatorId']), body);
    const result = await invokeTeam(d.coordinatorOrchestrator, invocation);
    return reply.send(
      successEnvelope({
        runId: result.runId,
        teamId: result.teamId,
        coordinatorAgentId: result.coordinatorAgentId,
        externalResponse: result.externalResponse,
        specialistResults: result.specialistResults,
        events: result.events,
      }),
    );
  });
}
