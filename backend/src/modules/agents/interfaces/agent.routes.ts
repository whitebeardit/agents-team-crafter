import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { paginationQuerySchema, paginationMeta } from '../../../shared/kernel/pagination.js';
import {
  agentDomainSchema,
  missionSchema,
  knowledgeSchema,
  toolsSchema,
  channelsCfgSchema,
  securitySchema,
  qualityCriteriaSchema,
  systemRoleSchema,
} from '../application/agent-config.schemas.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import { getWorkspaceOverlapMode } from '../../governance/application/workspace-overlap-mode.js';
import { assertWorkspaceQuota } from '../../workspaces/application/workspace-plan-limits.js';

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
  goal: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  domain: agentDomainSchema.optional(),
  qualityCriteria: qualityCriteriaSchema,
  reuseHints: z.array(z.string()).optional(),
  platformManaged: z.boolean().optional(),
  systemRole: systemRoleSchema,
  allowConflictOverride: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
  category: z.string().optional(),
  channels: z.array(z.enum(['whatsapp', 'slack', 'email', 'api'])).optional(),
  goal: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  domain: agentDomainSchema.optional(),
  qualityCriteria: qualityCriteriaSchema,
  reuseHints: z.array(z.string()).optional(),
  platformManaged: z.boolean().optional(),
  systemRole: systemRoleSchema,
  allowConflictOverride: z.boolean().optional(),
});

function asRec(a: unknown): Record<string, unknown> {
  return a as Record<string, unknown>;
}

async function loadAgent(deps: IAppDeps, ws: string, id: string) {
  const a = await deps.agentRepo.findById(ws, id);
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

export async function registerAgentRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/agents/categories', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const cats = await deps.agentRepo.distinctCategories(ws);
    return reply.send(successEnvelope(cats));
  });

  app.get('/agents', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuerySchema.parse(req.query);
    const { items, total } = await deps.agentRepo.list(
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
    await assertWorkspaceQuota(deps.settingsRepo, ws, 'agents');
    if (body.role === 'specialist' && body.channels.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Especialistas nao podem ter lista de canais na criacao; apenas coordenadores configuram canais.',
        400,
      );
    }
    const governanceReview = await deps.domainGuardService.review(ws, {
      name: body.name,
      description: body.description,
      role: body.role,
      category: body.category,
      skills: body.skills,
      goal: body.goal,
      responsibilities: body.responsibilities,
      domain: body.domain,
      qualityCriteria: body.qualityCriteria,
      reuseHints: body.reuseHints,
      platformManaged: body.platformManaged,
      systemRole: body.systemRole,
    });
    await deps.agentOverlapReviewRepo.create(ws, {
      draftAgent: governanceReview.draftAgent,
      matches: governanceReview.matches,
      decision: governanceReview.decision,
      summary: governanceReview.summary,
    });
    await deps.governanceAuditRepo.append({
      workspaceId: ws,
      userId: req.user!.sub,
      correlationId: req.requestId,
      eventType: 'governance.overlap_review',
      payload: {
        route: 'agent.create',
        draftName: body.name,
        role: body.role,
        decision: governanceReview.decision,
      },
    });
    const overlapMode = await getWorkspaceOverlapMode(deps, ws);
    const wouldBlockCreate =
      body.role === 'specialist'
      && (governanceReview.decision === 'block' || governanceReview.decision === 'reuse_existing')
      && body.allowConflictOverride !== true;
    if (wouldBlockCreate && overlapMode === 'blocking') {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.agent_blocked',
        payload: { route: 'agent.create', decision: governanceReview.decision },
      });
      throw new AppError('CONFLICT', governanceReview.summary, 409, { review: governanceReview });
    }
    if (wouldBlockCreate && overlapMode === 'warning') {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.overlap_warning_allowed',
        payload: { route: 'agent.create', decision: governanceReview.decision },
      });
    }
    const normalizedCategory = normalizeAgentCategory(body.category ?? 'Geral');
    const created = await deps.agentRepo.create(ws, {
      name: body.name,
      description: body.description ?? '',
      role: body.role,
      origin: 'company',
      skills: body.skills,
      category: normalizedCategory,
      channels: body.channels,
      status: 'active',
      version: '1.0.0',
      goal: body.goal,
      responsibilities: body.responsibilities ?? [],
      domain: body.domain,
      qualityCriteria: body.qualityCriteria ?? [],
      reuseHints: body.reuseHints ?? [],
      platformManaged: body.platformManaged ?? false,
      systemRole: body.systemRole ?? null,
    });
    const overrideOnCreate =
      body.role === 'specialist'
      && (governanceReview.decision === 'block' || governanceReview.decision === 'reuse_existing')
      && body.allowConflictOverride === true;
    if (overrideOnCreate) {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.override_applied',
        payload: { route: 'agent.create', decision: governanceReview.decision },
      });
    }
    const createMeta: Record<string, unknown> =
      wouldBlockCreate && overlapMode === 'warning'
        ? {
            governanceWarning: {
              decision: governanceReview.decision,
              summary: governanceReview.summary,
              matches: governanceReview.matches,
            },
          }
        : {};
    return reply.code(201).send(successEnvelope(created, createMeta));
  });

  app.get('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const a = await loadAgent(deps, ws, id);
    return reply.send(successEnvelope(a));
  });

  app.put('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = updateAgentSchema.parse(req.body);
    const current = cur as Record<string, unknown>;
    if (body.channels !== undefined && cur['role'] !== 'coordinator') {
      assertCoordinatorForChannels(cur);
    }
    const patch: typeof body = { ...body };
    if (patch.category !== undefined) {
      patch.category = normalizeAgentCategory(patch.category);
    }
    const draftForReview = {
      id,
      name: patch.name ?? String(current['name'] ?? ''),
      description: patch.description ?? String(current['description'] ?? ''),
      role: String(current['role'] ?? 'specialist') as 'coordinator' | 'specialist',
      category: patch.category ?? String(current['category'] ?? 'geral'),
      skills: patch.skills ?? ((current['skills'] as string[]) ?? []),
      goal: patch.goal ?? (current['goal'] as string | undefined),
      responsibilities: patch.responsibilities ?? ((current['responsibilities'] as string[]) ?? []),
      domain:
        patch.domain
        ?? ((current['domain'] as Record<string, unknown> | undefined) as {
          summary?: string;
          keywords?: string[];
          inputDescription?: string;
          outputDescription?: string;
          boundaries?: string[];
          exclusions?: string[];
        }),
      qualityCriteria: patch.qualityCriteria ?? ((current['qualityCriteria'] as string[]) ?? []),
      reuseHints: patch.reuseHints ?? ((current['reuseHints'] as string[]) ?? []),
      platformManaged: patch.platformManaged ?? Boolean(current['platformManaged']),
      systemRole:
        patch.systemRole
        ?? ((current['systemRole'] as 'team-crafter' | 'agent-crafter' | 'domain-guard' | null | undefined) ?? null),
    };
    const governanceReview = await deps.domainGuardService.review(ws, draftForReview);
    await deps.agentOverlapReviewRepo.create(ws, {
      draftAgent: governanceReview.draftAgent,
      matches: governanceReview.matches,
      decision: governanceReview.decision,
      summary: governanceReview.summary,
    });
    await deps.governanceAuditRepo.append({
      workspaceId: ws,
      userId: req.user!.sub,
      correlationId: req.requestId,
      eventType: 'governance.overlap_review',
      payload: {
        route: 'agent.update',
        agentId: id,
        draftName: draftForReview.name,
        role: draftForReview.role,
        decision: governanceReview.decision,
      },
    });
    const overlapModeUpdate = await getWorkspaceOverlapMode(deps, ws);
    const wouldBlockUpdate =
      draftForReview.role === 'specialist'
      && (governanceReview.decision === 'block' || governanceReview.decision === 'reuse_existing')
      && body.allowConflictOverride !== true;
    if (wouldBlockUpdate && overlapModeUpdate === 'blocking') {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.agent_blocked',
        payload: { route: 'agent.update', agentId: id, decision: governanceReview.decision },
      });
      throw new AppError('CONFLICT', governanceReview.summary, 409, { review: governanceReview });
    }
    if (wouldBlockUpdate && overlapModeUpdate === 'warning') {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.overlap_warning_allowed',
        payload: { route: 'agent.update', agentId: id, decision: governanceReview.decision },
      });
    }
    delete patch.allowConflictOverride;
    const updated = await deps.agentRepo.update(ws, id, patch);
    const overrideOnUpdate =
      draftForReview.role === 'specialist'
      && (governanceReview.decision === 'block' || governanceReview.decision === 'reuse_existing')
      && body.allowConflictOverride === true;
    if (overrideOnUpdate) {
      await deps.governanceAuditRepo.append({
        workspaceId: ws,
        userId: req.user!.sub,
        correlationId: req.requestId,
        eventType: 'governance.override_applied',
        payload: { route: 'agent.update', agentId: id, decision: governanceReview.decision },
      });
    }
    const updateMeta: Record<string, unknown> =
      wouldBlockUpdate && overlapModeUpdate === 'warning'
        ? {
            governanceWarning: {
              decision: governanceReview.decision,
              summary: governanceReview.summary,
              matches: governanceReview.matches,
            },
          }
        : {};
    return reply.send(successEnvelope(updated, updateMeta));
  });

  app.delete('/agents/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const teams = await deps.teamRepo.findTeamsReferencingAgent(ws, id);
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
    await deps.agentRepo.softDelete(ws, id);
    return reply.send(successEnvelope({ message: 'Agente removido com sucesso' }));
  });

  app.post('/agents/:id/archive', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const updated = await deps.agentRepo.update(ws, id, { status: 'archived' });
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
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    await deps.agentRepo.update(ws, id, { status: 'active' });
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
    const a = await loadAgent(deps, ws, id);
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
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = z.record(z.string(), z.unknown()).parse(req.body);
    delete body['handoff'];
    await deps.agentRepo.update(ws, id, body);
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
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = missionSchema.parse(req.body);
    await deps.agentRepo.update(ws, id, body);
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/knowledge', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = knowledgeSchema.parse(req.body);
    await deps.agentRepo.update(ws, id, { knowledge: body });
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/tools', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = toolsSchema.parse(req.body);
    const cap = { ...(asRec(cur)['capabilities'] as Record<string, unknown> | undefined) };
    delete cap['canDelegate'];
    delete cap['canReceiveHandoff'];
    await deps.agentRepo.update(ws, id, {
      capabilities: {
        ...cap,
        tools: body.tools,
        ...(body.customToolDefinitionIds !== undefined
          ? { customToolDefinitionIds: body.customToolDefinitionIds }
          : {}),
      },
    });
    return reply.send(successEnvelope({ tools: body.tools, customToolDefinitionIds: body.customToolDefinitionIds }));
  });

  app.put('/agents/:id/channels', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    assertCoordinatorForChannels(cur);
    const body = channelsCfgSchema.parse(req.body);
    await deps.agentRepo.update(ws, id, { channelConfig: body });
    return reply.send(successEnvelope(body));
  });

  app.put('/agents/:id/security', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const cur = await loadAgent(deps, ws, id);
    assertCompany(cur);
    const body = securitySchema.parse(req.body);
    await deps.agentRepo.update(ws, id, { security: body });
    return reply.send(successEnvelope(body));
  });

}
