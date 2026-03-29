import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { requireAdmin } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { putWorkspaceIntegrationsBodySchema } from '../domain/workspace-integrations.schema.js';

const workspacePut = z.object({
  name: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const profilePut = z.object({
  name: z.string().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

const createKeyBody = z.object({
  name: z.string().min(1),
});

const testSmtpBody = z.object({
  to: z.string().email(),
});

export async function registerSettingsRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.get('/settings/workspace', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await d.settingsRepo.getWorkspace(ws);
    if (!data) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.get('/settings/workspace/integrations', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await d.workspaceIntegrationsService.getMasked(ws);
    return reply.send(successEnvelope(data));
  });

  app.put('/settings/workspace/integrations', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = putWorkspaceIntegrationsBodySchema.parse(req.body);
    const secretsMasked = await d.workspaceIntegrationsService.putPartial(ws, body);
    return reply.send(
      successEnvelope({ message: 'Integracoes atualizadas', secretsMasked }),
    );
  });

  app.post(
    '/settings/workspace/integrations/test-openai',
    { preHandler: [...tenant, requireAdmin()] },
    async (req, reply) => {
      const ws = req.workspaceId!;
      const r = await d.workspaceIntegrationsService.testOpenAi(ws);
      return reply.send(successEnvelope(r));
    },
  );

  app.post(
    '/settings/workspace/integrations/test-smtp',
    { preHandler: [...tenant, requireAdmin()] },
    async (req, reply) => {
      const ws = req.workspaceId!;
      const { to } = testSmtpBody.parse(req.body);
      const r = await d.workspaceIntegrationsService.testSmtp(ws, to);
      return reply.send(successEnvelope(r));
    },
  );

  app.put('/settings/workspace', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = workspacePut.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.settings !== undefined) {
      const cur = await d.workspaceRepo.findById(ws);
      const merged = { ...((cur?.settings as Record<string, unknown>) ?? {}), ...body.settings };
      patch.settings = merged;
    }
    await d.workspaceRepo.updateWorkspace(ws, patch as { name?: string; settings?: Record<string, unknown> });
    return reply.send(successEnvelope({ message: 'Configuracoes atualizadas com sucesso' }));
  });

  app.get('/settings/profile', { preHandler: [d.authenticate] }, async (req, reply) => {
    const u = await d.userRepo.findById(req.user!.sub);
    if (!u) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404);
    return reply.send(
      successEnvelope({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        preferences: u.preferences ?? {},
      }),
    );
  });

  app.put('/settings/profile', { preHandler: [d.authenticate] }, async (req, reply) => {
    const body = profilePut.parse(req.body);
    const cur = await d.userRepo.findById(req.user!.sub);
    if (!cur) throw new AppError('NOT_FOUND', 'Usuario nao encontrado', 404);
    const mergedPrefs =
      body.preferences !== undefined
        ? { ...((cur.preferences as Record<string, unknown>) ?? {}), ...body.preferences }
        : undefined;
    await d.userRepo.updateProfile(req.user!.sub, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(mergedPrefs !== undefined ? { preferences: mergedPrefs } : {}),
    });
    return reply.send(successEnvelope({ message: 'Perfil atualizado com sucesso' }));
  });

  app.post('/settings/profile/avatar', { preHandler: [d.authenticate] }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw new AppError('VALIDATION_ERROR', 'Arquivo file obrigatorio', 400);
    await file.toBuffer();
    const avatarUrl = `/users/${req.user!.sub}-${Date.now()}.png`;
    await d.userRepo.updateProfile(req.user!.sub, { avatar: avatarUrl });
    return reply.send(successEnvelope({ avatarUrl }));
  });

  app.get('/settings/api-keys', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const data = await d.apiKeyRepo.list(ws);
    return reply.send(successEnvelope(data));
  });

  app.post('/settings/api-keys', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createKeyBody.parse(req.body);
    const data = await d.apiKeyRepo.create(ws, body.name);
    return reply.code(201).send(successEnvelope(data));
  });

  app.delete('/settings/api-keys/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const ok = await d.apiKeyRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Chave nao encontrada', 404);
    return reply.send(successEnvelope({ message: 'Chave de API removida com sucesso' }));
  });

  app.post('/settings/api-keys/:id/regenerate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await d.apiKeyRepo.regenerate(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Chave nao encontrada', 404);
    return reply.send(successEnvelope(data));
  });
}
