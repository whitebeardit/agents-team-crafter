import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { errorEnvelope, successEnvelope } from '../../../shared/kernel/envelope.js';
import { requireAdmin } from '../../../config/container.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { takeSimpleRateLimit } from '../../../shared/kernel/simple-rate-limit.js';
import { takeRedisFixedWindowRateLimit } from '../../../infrastructure/redis-rate-limit.js';
import {
  governanceFlagsPatchSchema,
  mergeGovernanceFlags,
} from '../application/governance-feature-flags.js';
import { buildGovernanceOpsSummary } from '../application/governance-ops.service.js';
import {
  buildGovernanceAuditTrend,
  buildGovernanceRunsTrend,
  buildGovernanceTeamSlos,
} from '../application/governance-analytics.service.js';
import { paginationQuerySchema, paginationMeta } from '../../../shared/kernel/pagination.js';

const trendDaysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(14),
});

const sloQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
  sloTargetPercent: z.coerce.number().min(50).max(99.99).optional().default(95),
});

async function applyGovernanceAuditRateLimit(
  deps: IAppDeps,
  workspaceId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const key = `gov-audit:${workspaceId}:${userId}`;
  const max = 240;
  const windowSec = 60;
  if (deps.redis) {
    try {
      return await takeRedisFixedWindowRateLimit(deps.redis, key, max, windowSec);
    } catch {
      /* fallback abaixo */
    }
  }
  const rl = takeSimpleRateLimit({
    key,
    max,
    windowMs: windowSec * 1000,
  });
  if (!rl.ok) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(rl.retryAfterMs / 1000)) };
  }
  return { ok: true };
}

export async function registerGovernanceRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/governance/feature-flags', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const record = await deps.workspaceRepo.findById(ws);
    if (!record) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    const flags = mergeGovernanceFlags(record.settings as Record<string, unknown>);
    return reply.send(successEnvelope(flags));
  });

  app.put('/governance/feature-flags', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = governanceFlagsPatchSchema.parse(req.body ?? {});
    const record = await deps.workspaceRepo.findById(ws);
    if (!record) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    const settings = { ...(record.settings as Record<string, unknown>) };
    const prev = mergeGovernanceFlags(settings);
    const webhook =
      body.sloWebhookUrl !== undefined
        ? body.sloWebhookUrl.trim() === ''
          ? undefined
          : body.sloWebhookUrl.trim()
        : prev.sloWebhookUrl;
    const nextGov = {
      overlapMode: body.overlapMode ?? prev.overlapMode,
      agentWizardDefaultPath: body.agentWizardDefaultPath ?? prev.agentWizardDefaultPath,
      sloAlertsEnabled: body.sloAlertsEnabled ?? prev.sloAlertsEnabled,
      ...(webhook ? { sloWebhookUrl: webhook } : {}),
    };
    settings['governance'] = nextGov;
    const updated = await deps.workspaceRepo.updateWorkspace(ws, { settings });
    if (!updated) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    return reply.send(successEnvelope(mergeGovernanceFlags(updated.settings as Record<string, unknown>)));
  });

  app.get('/governance/ops-summary', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const opsSummary = await buildGovernanceOpsSummary(ws, {
      runRepo: deps.runRepo,
      agentOverlapReviewRepo: deps.agentOverlapReviewRepo,
      governanceAuditRepo: deps.governanceAuditRepo,
    });
    return reply.send(successEnvelope(opsSummary));
  });

  app.get('/governance/runs-trend', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = trendDaysQuerySchema.parse(req.query);
    const runsTrend = await buildGovernanceRunsTrend(ws, deps.runRepo, q.days);
    return reply.send(successEnvelope(runsTrend));
  });

  app.get('/governance/audit-trend', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = trendDaysQuerySchema.parse(req.query);
    const auditTrend = await buildGovernanceAuditTrend(ws, deps.governanceAuditRepo, q.days);
    return reply.send(successEnvelope(auditTrend));
  });

  app.get('/governance/team-slos', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = sloQuerySchema.parse(req.query);
    const recordAlertsRaw = (req.query as Record<string, string | undefined>)['recordAlerts'];
    const recordAlerts =
      recordAlertsRaw === 'false' || recordAlertsRaw === '0' ? false : true;
    const record = await deps.workspaceRepo.findById(ws);
    if (!record) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    const gov = mergeGovernanceFlags(record.settings as Record<string, unknown>);
    const emitSloBreaches = recordAlerts && gov.sloAlertsEnabled;
    const teamSlos = await buildGovernanceTeamSlos(
      ws,
      {
        runRepo: deps.runRepo,
        teamRepo: deps.teamRepo,
        governanceAuditRepo: deps.governanceAuditRepo,
        redis: deps.redis,
        emitSloBreaches,
        sloWebhookUrl: gov.sloWebhookUrl,
      },
      q.days,
      q.sloTargetPercent,
    );
    return reply.send(successEnvelope(teamSlos));
  });

  app.get('/governance/audit-events', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const userId = req.user?.sub ?? 'anon';
    const rl = await applyGovernanceAuditRateLimit(deps, ws, userId);
    if (!rl.ok) {
      return reply
        .header('Retry-After', String(rl.retryAfterSec))
        .status(429)
        .send(
          errorEnvelope(
            'TOO_MANY_REQUESTS',
            'Muitas requisicoes de auditoria neste minuto; aguarde um instante.',
            { retryAfterSeconds: rl.retryAfterSec },
          ),
        );
    }
    const q = paginationQuerySchema.parse(req.query);
    const { items, total } = await deps.governanceAuditRepo.listPaged(ws, {
      page: q.page,
      perPage: q.perPage,
    });
    return reply.send(successEnvelope(items, paginationMeta(q.page, q.perPage, total)));
  });
}
