import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { buildSanitizedTemplatePayload } from '../application/create-template-from-team.service.js';
import {
  assertTemplatePayloadHasNoEncryptedSecrets,
  sanitizeTeamExportToTemplate,
  type TTeamTemplateExportPayload,
} from '../application/sanitize-template-export.js';
import { applyTemplateWithImport } from '../application/template-apply.service.js';
import { templateListScopeOr } from '../infra/template.repository.js';
import { TemplateModel } from '../infra/template.model.js';
import { parseExportPayload } from '../../teams/application/import-team-from-export.js';
import type { TTeamExportPayload } from '../../teams/application/build-team-export.js';

const listQuery = z.object({
  origin: z.enum(['whitebeard', 'company']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

const applyBody = z.object({
  teamName: z.string().min(1),
  teamDescription: z.string().optional(),
  mcpConnectionIdMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  /** legacyId de canal (do template) -> corpo de segredos (Chat SDK) em JSON */
  channelSecretPayloads: z.record(z.string().min(1), z.unknown()).optional(),
});

const saveBody = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('Geral'),
});

const importJsonBody = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('Geral'),
  origin: z.enum(['whitebeard', 'company']).default('company'),
  /** JSON com `exportKind` `template` (sanitizado) ou `team` (export completo — é convertido e limpo no servidor). */
  payload: z.unknown(),
});

const patchTemplateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  vertical: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  applyBehavior: z.string().optional(),
  validationSteps: z.array(z.string()).optional(),
  goldenPrompts: z.array(z.string()).optional(),
  expectedOutcome: z.string().optional(),
  /** Substituir payload: `exportKind` `template` ou `team` (mesma validação que POST /templates/import). */
  templatePayload: z.unknown().optional(),
});

function resolveTemplatePayloadFromImportFile(
  payload: unknown,
): { ok: true; value: TTeamTemplateExportPayload } | { ok: false; reason: string } {
  if (!payload || typeof payload !== 'object' || payload === null) {
    return { ok: false, reason: 'payload e obrigatorio' };
  }
  const p = payload as Record<string, unknown>;
  const ek = p['exportKind'];
  if (ek === 'template') {
    const v = assertTemplatePayloadHasNoEncryptedSecrets(p as TTeamTemplateExportPayload);
    if (!v.ok) return { ok: false, reason: v.reason };
    return { ok: true, value: p as TTeamTemplateExportPayload };
  }
  if (ek === 'team') {
    const parsed = parseExportPayload(payload);
    if (parsed.kind === 'error') {
      return { ok: false, reason: parsed.message };
    }
    const tpl = sanitizeTeamExportToTemplate(payload as TTeamExportPayload);
    const v = assertTemplatePayloadHasNoEncryptedSecrets(tpl);
    if (!v.ok) return { ok: false, reason: v.reason };
    return { ok: true, value: tpl };
  }
  return { ok: false, reason: 'exportKind deve ser "team" ou "template"' };
}

const teamExportDeps = (deps: IAppDeps) => ({
  agentRepo: deps.agentRepo,
  teamRepo: deps.teamRepo,
  teamGraphRepo: deps.teamGraphRepo,
  channelRepo: deps.channelRepo,
  agentMcpBindingRepo: deps.agentMcpBindingRepo,
});

export async function registerTemplateRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/templates', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuery.parse(req.query);
    const data = await deps.templateRepo.list(ws, q);
    return reply.send(successEnvelope(data));
  });

  app.get('/templates/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.templateRepo.findById(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  /** Download JSON (payload sanitizado) de um registo de template. */
  app.get('/templates/:id/export', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const doc = (await TemplateModel.findOne({ _id: id, ...templateListScopeOr(ws) } as never)
      .lean()
      .exec()) as { templatePayload?: TTeamTemplateExportPayload } | null;
    if (!doc?.templatePayload) {
      throw new AppError('NOT_FOUND', 'Template sem payload completo; use export de time (GET /teams/:id/template-export)', 404);
    }
    return reply.send(successEnvelope(doc.templatePayload));
  });

  app.post('/templates/:id/apply', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = applyBody.parse(req.body);
    const out = await applyTemplateWithImport(deps, deps.templateRepo, ws, id, {
      teamName: body.teamName,
      teamDescription: body.teamDescription,
      mcpConnectionIdMap: body.mcpConnectionIdMap,
      channelSecretPayloads: body.channelSecretPayloads,
    });
    if (!out) {
      throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    }
    const w = out.importMode === 'import' ? out.importWarnings : [];
    return reply.code(201).send(
      successEnvelope(
        { ...out.result, importWarnings: w, importMode: out.importMode },
        w.length > 0 ? { warnings: w } : {},
      ),
    );
  });

  app.post('/templates', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = saveBody.parse(req.body);
    const tpl = await buildSanitizedTemplatePayload(teamExportDeps(deps), ws, body.teamId, {
      includeSourceTeamId: true,
    });
    const v = assertTemplatePayloadHasNoEncryptedSecrets(tpl);
    if (!v.ok) {
      throw new AppError('VALIDATION_ERROR', v.reason, 400);
    }
    const created = await deps.templateRepo.createWithTemplatePayload(ws, {
      name: body.name,
      description: body.description,
      category: body.category,
      origin: 'company',
      templateScope: 'workspace',
      templatePayload: tpl,
    });
    return reply.code(201).send(successEnvelope(created));
  });

  /** Gravar catálogo a partir de ficheiro JSON (template sanitizado ou export de time v2). */
  app.post('/templates/import', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const b = importJsonBody.parse(req.body);
    const resolved = resolveTemplatePayloadFromImportFile(b.payload);
    if (!resolved.ok) {
      throw new AppError('VALIDATION_ERROR', resolved.reason, 400);
    }
    const created = await deps.templateRepo.createWithTemplatePayload(ws, {
      name: b.name,
      description: b.description,
      category: b.category,
      origin: b.origin,
      templateScope: 'workspace',
      templatePayload: resolved.value,
    });
    return reply.code(201).send(successEnvelope(created));
  });

  app.patch('/templates/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = patchTemplateBody.parse(req.body ?? {});
    const tpl = await deps.templateRepo.findById(ws, id);
    if (!tpl) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    if (tpl.origin === 'whitebeard') {
      throw new AppError('FORBIDDEN', 'Templates Whitebeard nao editaveis', 403);
    }
    if ((tpl as { templateScope?: string }).templateScope === 'global') {
      throw new AppError('FORBIDDEN', 'Template global nao editavel', 403);
    }

    let nextPayload: TTeamTemplateExportPayload | undefined;
    if (body.templatePayload !== undefined) {
      const resolved = resolveTemplatePayloadFromImportFile(body.templatePayload);
      if (!resolved.ok) {
        throw new AppError('VALIDATION_ERROR', resolved.reason, 400);
      }
      nextPayload = resolved.value;
    }

    const updated = await deps.templateRepo.updateCompany(ws, id, {
      name: body.name,
      description: body.description,
      category: body.category,
      vertical: body.vertical,
      prerequisites: body.prerequisites,
      applyBehavior: body.applyBehavior,
      validationSteps: body.validationSteps,
      goldenPrompts: body.goldenPrompts,
      expectedOutcome: body.expectedOutcome,
      templatePayload: nextPayload,
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.send(successEnvelope(updated));
  });

  app.delete('/templates/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const tpl = await deps.templateRepo.findById(ws, id);
    if (!tpl) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    if (tpl.origin === 'whitebeard' && (tpl as { templateScope?: string }).templateScope !== 'global') {
      throw new AppError('FORBIDDEN', 'Template catalogo somente leitura', 403);
    }
    if ((tpl as { templateScope?: string })['templateScope'] === 'global') {
      throw new AppError('FORBIDDEN', 'Remocao de template global nao suportada nesta rota', 403);
    }
    const ok = await deps.templateRepo.deleteCompany(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Template nao encontrado', 404);
    return reply.send(successEnvelope({ message: 'Template removido com sucesso' }));
  });
}

export const templatePlatformPromoteBodySchema = z.object({
  workspaceId: z.string().min(1),
  teamId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('Geral'),
  templateScope: z.enum(['global', 'workspace']).default('global'),
});

/**
 * Rota de plataforma (registada em platform.routes).
 */
export async function registerPlatformTemplateRoutes(app: FastifyInstance, deps: IAppDeps) {
  const platformAdmin = [deps.authenticate, deps.requirePlatformAdmin];

  app.post(
    '/platform/templates/promote-from-team',
    { preHandler: platformAdmin },
    async (req, reply) => {
      const body = templatePlatformPromoteBodySchema.parse(req.body ?? {});
      const tpl = await buildSanitizedTemplatePayload(teamExportDeps(deps), body.workspaceId, body.teamId, {
        includeSourceTeamId: false,
      });
      const v = assertTemplatePayloadHasNoEncryptedSecrets(tpl);
      if (!v.ok) {
        throw new AppError('VALIDATION_ERROR', v.reason, 400);
      }
      const targetWs = body.templateScope === 'global' ? body.workspaceId : body.workspaceId;
      const created = await deps.templateRepo.createWithTemplatePayload(targetWs, {
        name: body.name,
        description: body.description,
        category: body.category,
        origin: 'whitebeard',
        templateScope: body.templateScope,
        templatePayload: tpl,
      });
      return reply.code(201).send(successEnvelope(created));
    },
  );
}
