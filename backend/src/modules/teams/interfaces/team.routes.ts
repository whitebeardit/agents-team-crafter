import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
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
import { getTeamGalleryService } from '../application/team-gallery.service.js';
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

async function assertCoordinatorRole(deps: IAppDeps, workspaceId: string, agentId: string): Promise<void> {
  const row = await deps.agentRepo.findById(workspaceId, agentId);
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

export async function registerTeamRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/teams', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listTeamsQuery.parse(req.query);
    const { items, total } = await deps.teamRepo.list(
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
    const coordOk = await deps.agentRepo.existsAll(ws, [body.coordinatorId]);
    if (!coordOk) throw new AppError('VALIDATION_ERROR', 'Coordenador invalido', 400);
    await assertCoordinatorRole(deps, ws, body.coordinatorId);
    const agentsOk = await deps.agentRepo.existsAll(ws, body.agentIds);
    if (!agentsOk) throw new AppError('VALIDATION_ERROR', 'Agente invalido no time', 400);
    const chOk = await deps.channelRepo.existsAll(ws, body.channelIds);
    if (!chOk) throw new AppError('VALIDATION_ERROR', 'Canal invalido no time', 400);
    const created = await deps.teamRepo.create(ws, {
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
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const g = await deps.teamGraphRepo.get(ws, teamId);
    const enrichTeam = {
      coordinatorId: team.coordinatorId,
      agentIds: team.agentIds,
      channelIds: team.channelIds,
    };
    const normalizedNodes = normalizeGraphNodesEntityFields(g.nodes, enrichTeam);
    const workspaceAgentIds = await deps.agentRepo.listAllIds(ws);
    const cleanEdges = stripDerivedGraphEdges(g.edges);
    const { edges: persistedFixed, changed } = normalizePersistedChannelEdgesToCoordinator(
      normalizedNodes as IGraphNode[],
      cleanEdges,
      enrichTeam,
      { agentIds: workspaceAgentIds },
    );
    if (changed) {
      await deps.teamGraphRepo.upsert(ws, teamId, normalizedNodes, persistedFixed);
    }
    const payload = enrichTeamGraphPayload(normalizedNodes, persistedFixed, enrichTeam);
    return reply.send(successEnvelope({ nodes: payload.nodes, edges: payload.edges }));
  });

  app.put('/teams/:id/graph', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = graphBodySchema.parse(req.body);
    const enrichTeam = {
      coordinatorId: team.coordinatorId,
      agentIds: team.agentIds,
      channelIds: team.channelIds,
    };
    const normalizedNodes = normalizeGraphNodesEntityFields(body.nodes, enrichTeam);
    const cleanEdges = stripDerivedGraphEdges(body.edges);
    const agentIds = await deps.agentRepo.listAllIds(ws);
    const channelIds = await deps.channelRepo.listAllIds(ws);
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
    await deps.teamGraphRepo.upsert(ws, teamId, normalizedNodes, edgesToPersist);
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
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = graphBodySchema.parse(req.body);
    const agentIds = await deps.agentRepo.listAllIds(ws);
    const channelIds = await deps.channelRepo.listAllIds(ws);
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

  const gallerySvc = getTeamGalleryService();

  app.get('/teams/:id/gallery', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const name = String((team as Record<string, unknown>)['name'] ?? '');
    const albums = await gallerySvc.listAlbums(ws, teamId, name);
    return reply.send(successEnvelope({ albums }));
  });

  app.get('/teams/:id/gallery/:subject/files', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const subjectRaw = (req.params as { subject: string }).subject;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const name = String((team as Record<string, unknown>)['name'] ?? '');
    let subject: string;
    try {
      subject = decodeURIComponent(subjectRaw);
    } catch {
      subject = subjectRaw;
    }
    const files = await gallerySvc.listFiles(ws, teamId, name, subject);
    return reply.send(successEnvelope({ files }));
  });

  app.get('/teams/:id/gallery/:subject/file/:filename', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const subjectRaw = (req.params as { subject: string }).subject;
    const filenameRaw = (req.params as { filename: string }).filename;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const name = String((team as Record<string, unknown>)['name'] ?? '');
    let subject: string;
    let filename: string;
    try {
      subject = decodeURIComponent(subjectRaw);
      filename = decodeURIComponent(filenameRaw);
    } catch {
      subject = subjectRaw;
      filename = filenameRaw;
    }
    const buf = await gallerySvc.readFileBuffer(ws, teamId, name, subject, filename);
    if (!buf) throw new AppError('NOT_FOUND', 'Ficheiro nao encontrado', 404);
    return reply
      .header('Cache-Control', 'private, max-age=3600')
      .type(gallerySvc.guessContentType(filename))
      .send(buf);
  });

  app.delete('/teams/:id/gallery/:subject/file/:filename', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const subjectRaw = (req.params as { subject: string }).subject;
    const filenameRaw = (req.params as { filename: string }).filename;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const name = String((team as Record<string, unknown>)['name'] ?? '');
    let subject: string;
    let filename: string;
    try {
      subject = decodeURIComponent(subjectRaw);
      filename = decodeURIComponent(filenameRaw);
    } catch {
      subject = subjectRaw;
      filename = filenameRaw;
    }
    const ok = await gallerySvc.deleteFile(ws, teamId, name, subject, filename);
    if (!ok) throw new AppError('NOT_FOUND', 'Ficheiro nao encontrado', 404);
    return reply.send(successEnvelope({ deleted: true }));
  });

  app.get('/teams/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, id);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const t = team as Record<string, unknown>;
    const coordId = String(t['coordinatorId']);
    const agentIds = (t['agentIds'] as string[]) ?? [];
    const channelIds = (t['channelIds'] as string[]) ?? [];
    const coordinator = await deps.agentRepo.findById(ws, coordId);
    const agents = [];
    for (const aid of agentIds) {
      const ag = await deps.agentRepo.findById(ws, aid);
      if (ag) agents.push(ag);
    }
    const chRows = await deps.channelRepo.listByIds(ws, channelIds);
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
      const ok = await deps.agentRepo.existsAll(ws, [body.coordinatorId]);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Coordenador invalido', 400);
      await assertCoordinatorRole(deps, ws, body.coordinatorId);
    }
    if (body.agentIds) {
      const ok = await deps.agentRepo.existsAll(ws, body.agentIds);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Agente invalido', 400);
    }
    if (body.channelIds) {
      const ok = await deps.channelRepo.existsAll(ws, body.channelIds);
      if (!ok) throw new AppError('VALIDATION_ERROR', 'Canal invalido', 400);
    }
    const current = await deps.teamRepo.findById(ws, id);
    if (!current) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const cur = current as Record<string, unknown>;
    const nextStatus = body.status ?? (cur['status'] as string);
    const nextChannelIds = (body.channelIds ?? (cur['channelIds'] as string[])) as string[];
    if (nextStatus === 'active') {
      await assertActiveChannelBindingUnique(deps.teamRepo, ws, nextChannelIds, id);
    }
    const updated = await deps.teamRepo.update(ws, id, body as Record<string, unknown>);
    if (!updated) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.send(successEnvelope(updated));
  });

  app.delete('/teams/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    await deps.teamRepo.delete(ws, id);
    return reply.send(successEnvelope({ message: 'Time removido com sucesso' }));
  });

  app.post('/teams/:id/activate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, id);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const chIds = ((team as Record<string, unknown>)['channelIds'] as string[]) ?? [];
    await assertActiveChannelBindingUnique(deps.teamRepo, ws, chIds, id);
    const updated = await deps.teamRepo.update(ws, id, { status: 'active' });
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
    const updated = await deps.teamRepo.update(ws, id, { status: 'inactive' });
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
    const dup = await deps.teamRepo.duplicate(ws, id, body.name);
    if (!dup) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    return reply.code(201).send(successEnvelope(dup));
  });

  app.post('/teams/:id/run', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = teamRunBodySchema.parse(req.body);
    const t = team as Record<string, unknown>;
    const startedAt = new Date();
    const invocation = buildManualTeamInvocation(
      ws,
      String(t['id']),
      String(t['coordinatorId']),
      body,
      req.requestId,
    );
    try {
      const result = await invokeTeam(deps.coordinatorOrchestrator, invocation);
      await deps.runRecorderService.recordCompleted({
        workspaceId: ws,
        teamId,
        trigger: 'manual_http',
        source: 'manual',
        channel: body.channel,
        correlationId: req.requestId,
        startedAt,
        result,
      });
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
    } catch (err) {
      await deps.runRecorderService.recordFailed({
        workspaceId: ws,
        teamId,
        runId: randomUUID(),
        coordinatorAgentId: String(t['coordinatorId']),
        trigger: 'manual_http',
        source: 'manual',
        channel: body.channel,
        correlationId: req.requestId,
        startedAt,
        error: {
          code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : String(err),
          status: err instanceof AppError ? err.httpStatus : 500,
        },
      });
      throw err;
    }
  });

  /**
   * SSE: subscribe to live team runs (inbound Chat SDK + manual) — same events as POST /teams/:id/run/stream.
   */
  app.get('/teams/:id/live', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);

    const stream = new PassThrough();
    reply.headers({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeSse = (event: string, data: unknown) => {
      try {
        if (!stream.writableEnded) {
          stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      } catch {
        try {
          stream.destroy();
        } catch {
          /* ignore */
        }
      }
    };

    const unsub = await deps.teamLiveBroadcaster.subscribe(ws, teamId, (env) => {
      try {
        if (env.event === 'agentStatus') writeSse('agentStatus', env.data);
        else if (env.event === 'coordinatorDelta') {
          const data =
            typeof env.data === 'object' && env.data !== null
              ? { ...(env.data as Record<string, unknown>), source: env.source }
              : { source: env.source, payload: env.data };
          writeSse('coordinatorDelta', data);
        }
        else if (env.event === 'runComplete') {
          const data =
            typeof env.data === 'object' && env.data !== null
              ? { ...(env.data as Record<string, unknown>), source: env.source }
              : { source: env.source, payload: env.data };
          writeSse('runComplete', data);
        } else if (env.event === 'error') writeSse('error', env.data);
        else if (env.event === 'inboundUserMessage') writeSse('inboundUserMessage', env.data);
      } catch {
        /* never break webhook path */
      }
    });

    const heartbeat = setInterval(() => {
      try {
        if (!stream.writableEnded) stream.write(': ping\n\n');
      } catch {
        /* ignore */
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsub();
      if (!stream.writableEnded) stream.end();
    };

    req.raw.on('close', cleanup);

    return reply.send(stream);
  });

  /**
   * SSE: same payload as POST /teams/:id/run plus live agentStatus and coordinatorDelta events.
   * Body: teamRunBodySchema (JSON).
   */
  app.post('/teams/:id/run/stream', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const teamId = (req.params as { id: string }).id;
    const team = await deps.teamRepo.findById(ws, teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
    const body = teamRunBodySchema.parse(req.body);
    const t = team as Record<string, unknown>;
    const startedAt = new Date();
    const invocation = buildManualTeamInvocation(
      ws,
      String(t['id']),
      String(t['coordinatorId']),
      body,
      req.requestId,
    );

    const stream = new PassThrough();
    reply.headers({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeSse = (event: string, data: unknown) => {
      stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let streamRunId: string | undefined;

    void (async () => {
      try {
        const result = await invokeTeam(deps.coordinatorOrchestrator, invocation, {
          onProgress: (e) => {
            streamRunId = e.runId;
            writeSse('agentStatus', e);
            deps.teamLiveBroadcaster.publishAgentStatus(ws, teamId, 'manual', e);
          },
          streamCoordinatorText: true,
          onCoordinatorTextDelta: (text) => {
            const payload = { text, runId: streamRunId, source: 'manual' as const };
            writeSse('coordinatorDelta', payload);
            if (streamRunId) {
              deps.teamLiveBroadcaster.publish(ws, teamId, {
                source: 'manual',
                runId: streamRunId,
                event: 'coordinatorDelta',
                data: payload,
              });
            }
          },
        });
        const complete = {
          runId: result.runId,
          teamId: result.teamId,
          coordinatorAgentId: result.coordinatorAgentId,
          externalResponse: result.externalResponse,
          specialistResults: result.specialistResults,
          events: result.events,
        };
        writeSse('runComplete', complete);
        await deps.runRecorderService.recordCompleted({
          workspaceId: ws,
          teamId,
          trigger: 'manual_stream',
          source: 'manual',
          channel: body.channel,
          correlationId: req.requestId,
          startedAt,
          result,
        });
        deps.teamLiveBroadcaster.publish(ws, teamId, {
          source: 'manual',
          runId: result.runId,
          event: 'runComplete',
          data: complete,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
        const status = err instanceof AppError ? err.httpStatus : 500;
        const errPayload = { code, message: errMsg, status };
        writeSse('error', errPayload);
        await deps.runRecorderService.recordFailed({
          workspaceId: ws,
          teamId,
          runId: streamRunId ?? randomUUID(),
          coordinatorAgentId: String(t['coordinatorId']),
          trigger: 'manual_stream',
          source: 'manual',
          channel: body.channel,
          correlationId: req.requestId,
          startedAt,
          error: errPayload,
        });
        deps.teamLiveBroadcaster.publish(ws, teamId, {
          source: 'manual',
          runId: streamRunId ?? randomUUID(),
          event: 'error',
          data: errPayload,
        });
      } finally {
        stream.end();
      }
    })();

    return reply.send(stream);
  });
}
