import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { requireAdmin } from '../../../config/container.js';
import { getBusinessActionPreset } from '../../business-tools/application/business-action-presets.js';
import { resolveDomainCapabilitySelection } from '../../business-tools/application/domain-capability-registry.js';
import { actionIdToToolSlug } from '../../team-planning/application/planner-pack-presets.js';
import type { WorkspaceToolDefinitionRepository } from '../infra/workspace-tool-definition.repository.js';

const toolDefinitionBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: z.enum(['builtin_ref', 'http_webhook', 'mcp_ref', 'internal_action']),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

function refineInternalAction(data: { kind?: string; config?: Record<string, unknown> }, ctx: z.RefinementCtx) {
  if (data.kind === 'internal_action') {
    const actionId = data.config?.actionId;
    if (typeof actionId !== 'string' || !actionId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'internal_action requer config.actionId (string nao vazia)',
      });
    }
  }
}

const createSchema = toolDefinitionBody.superRefine(refineInternalAction);

const updateSchema = toolDefinitionBody
  .partial()
  .extend({ enabled: z.boolean().optional() })
  .superRefine((data, ctx) => {
    if (data.kind === 'internal_action') refineInternalAction(data, ctx);
  });

const bulkInternalActionsSchema = z.object({
  actionIds: z.array(z.string()).min(1).max(64),
});

const bulkInternalActionDomainsSchema = z.object({
  domainIds: z.array(z.string().min(1)).min(1).max(32),
});

export async function registerToolDefinitionRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/tool-definitions', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await deps.workspaceToolDefinitionRepo.list(ws);
    return reply.send(successEnvelope(data));
  });

  app.get('/tool-definitions/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.workspaceToolDefinitionRepo.findById(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/tool-definitions', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createSchema.parse(req.body);
    try {
      const data = await deps.workspaceToolDefinitionRepo.create(ws, body);
      return reply.code(201).send(successEnvelope(data));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'code' in e && (e as { code?: number }).code === 11000;
      if (msg) throw new AppError('VALIDATION_ERROR', 'Slug ja existe neste workspace', 400);
      throw e;
    }
  });

  /**
   * Cria várias `internal_action` de uma vez (Loop 61). Idempotente por `actionId` no workspace:
   * já definidas ou sem handler no registry entram em `skipped`, não abortam o lote.
   */
  app.post('/tool-definitions/bulk-internal-actions', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const { actionIds: raw } = bulkInternalActionsSchema.parse(req.body);
    const seen = new Set<string>();
    const uniqueOrdered: string[] = [];
    for (const rawId of raw) {
      const id = rawId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniqueOrdered.push(id);
    }
    if (uniqueOrdered.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Nenhum actionId valido no pedido', 400);
    }

    const existing = await deps.workspaceToolDefinitionRepo.list(ws);
    const usedActionIds = new Set<string>();
    for (const t of existing) {
      if (t.kind === 'internal_action' && typeof t.config?.actionId === 'string') {
        usedActionIds.add(t.config.actionId);
      }
    }

    const created: Awaited<ReturnType<WorkspaceToolDefinitionRepository['list']>> = [];
    type TSkipped = { actionId: string; reason: 'already_defined' | 'not_in_catalog' | 'slug_collision' };
    const skipped: TSkipped[] = [];
    const errors: { actionId: string; message: string }[] = [];

    for (const actionId of uniqueOrdered) {
      if (!deps.businessToolRegistry.has(actionId)) {
        skipped.push({ actionId, reason: 'not_in_catalog' });
        continue;
      }
      if (usedActionIds.has(actionId)) {
        skipped.push({ actionId, reason: 'already_defined' });
        continue;
      }

      const preset = getBusinessActionPreset(actionId);
      const name = preset?.title ?? actionId;
      const slug = actionIdToToolSlug(actionId);

      try {
        const data = await deps.workspaceToolDefinitionRepo.create(ws, {
          name,
          slug,
          kind: 'internal_action',
          config: { actionId },
          jsonSchema: {
            type: 'object',
            properties: {},
            additionalProperties: true,
            description: `Parametros para a acao interna ${actionId}`,
          },
        });
        created.push(data);
        usedActionIds.add(actionId);
      } catch (e: unknown) {
        const dup = e && typeof e === 'object' && 'code' in e && (e as { code?: number }).code === 11000;
        if (dup) {
          skipped.push({ actionId, reason: 'slug_collision' });
        } else {
          errors.push({
            actionId,
            message: e instanceof Error ? e.message : 'Erro ao criar definicao',
          });
        }
      }
    }

    const payload = { created, skipped, errors };
    const code = created.length > 0 ? 201 : 200;
    return reply.code(code).send(successEnvelope(payload));
  });

  app.post('/tool-definitions/bulk-internal-action-domains', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const body = bulkInternalActionDomainsSchema.parse(req.body ?? {});
    const resolution = resolveDomainCapabilitySelection(body.domainIds);
    const registeredActionIds = resolution.actionIds.filter((actionId) => deps.businessToolRegistry.has(actionId));
    if (registeredActionIds.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Nenhuma action registada para os dominios informados', 400);
    }

    const existing = await deps.workspaceToolDefinitionRepo.list(req.workspaceId!);
    const usedActionIds = new Set<string>();
    for (const t of existing) {
      if (t.kind === 'internal_action' && typeof t.config?.actionId === 'string') usedActionIds.add(t.config.actionId);
    }

    const created: Awaited<ReturnType<WorkspaceToolDefinitionRepository['list']>> = [];
    type TSkipped = { actionId: string; reason: 'already_defined' | 'not_in_catalog' | 'slug_collision' };
    const skipped: TSkipped[] = [];
    const errors: { actionId: string; message: string }[] = [];
    for (const actionId of registeredActionIds) {
      if (usedActionIds.has(actionId)) {
        skipped.push({ actionId, reason: 'already_defined' });
        continue;
      }
      const preset = getBusinessActionPreset(actionId);
      try {
        const data = await deps.workspaceToolDefinitionRepo.create(req.workspaceId!, {
          name: preset?.title ?? actionId,
          slug: actionIdToToolSlug(actionId),
          kind: 'internal_action',
          config: { actionId },
          jsonSchema: {
            type: 'object',
            properties: {},
            additionalProperties: true,
            description: `Parametros para a acao interna ${actionId}`,
          },
        });
        created.push(data);
        usedActionIds.add(actionId);
      } catch (e: unknown) {
        const dup = e && typeof e === 'object' && 'code' in e && (e as { code?: number }).code === 11000;
        if (dup) skipped.push({ actionId, reason: 'slug_collision' });
        else errors.push({ actionId, message: e instanceof Error ? e.message : 'Erro ao criar definicao' });
      }
    }
    const payload = {
      created,
      skipped,
      errors,
      resolution: {
        ...resolution,
        actionIds: registeredActionIds,
        unavailableActionIds: resolution.actionIds.filter((actionId) => !deps.businessToolRegistry.has(actionId)),
      },
    };
    const code = created.length > 0 ? 201 : 200;
    return reply.code(code).send(successEnvelope(payload));
  });

  app.put('/tool-definitions/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateSchema.parse(req.body);
    const data = await deps.workspaceToolDefinitionRepo.update(ws, id, body);
    if (!data) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });

  app.delete('/tool-definitions/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const ok = await deps.workspaceToolDefinitionRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Tool nao encontrada', 404);
    return reply.send(successEnvelope({ deleted: true }));
  });
}
