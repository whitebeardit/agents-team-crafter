import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { requireAdmin } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { mockChannelConnect, mockChannelTest } from '../infra/channel.repository.js';
import { CHAT_SDK_PLATFORMS } from '../domain/chat-sdk-platform.js';
import { productChannelTypeSchema } from '../domain/product-channel-type.js';
import { parseChatSdkSecretsBody } from '../domain/chat-sdk-secrets.schema.js';
import { buildChatSdkWebhookUrl } from '../application/build-chat-sdk-webhook-url.js';
import { registerTelegramWebhookWithTelegramApi } from '../application/register-telegram-webhook.js';
import { assertWorkspaceQuota } from '../../workspaces/application/workspace-plan-limits.js';

const channelTypeEnum = productChannelTypeSchema;

const listQuery = z.object({
  type: channelTypeEnum.optional(),
  status: z.enum(['connected', 'disconnected', 'pending']).optional(),
  teamId: z.string().optional(),
});

const createBody = z.object({
  type: channelTypeEnum,
  name: z.string().min(1),
  teamId: z.string().optional(),
  provider: z.enum(['native', 'chat_sdk']).optional(),
  platform: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const updateBody = z.object({
  name: z.string().optional(),
  teamId: z.string().nullable().optional(),
  provider: z.enum(['native', 'chat_sdk']).optional(),
  platform: z.string().min(1).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const putSecretsBody = z
  .object({
    platform: z.enum(CHAT_SDK_PLATFORMS),
  })
  .passthrough();

export async function registerChannelRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/channels', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuery.parse(req.query);
    const rows = await deps.channelRepo.list(ws, q);
    const data = rows.map((row) => {
      const prov = row.provider;
      const plat = row.platform;
      const webhookUrl =
        prov === 'chat_sdk' && plat
          ? buildChatSdkWebhookUrl(req, ws, plat, row.id)
          : undefined;
      return { ...row, webhookUrl };
    });
    return reply.send(successEnvelope(data));
  });

  app.post('/channels', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createBody.parse(req.body);
    await assertWorkspaceQuota(deps.settingsRepo, ws, 'channels');
    if (body.teamId) {
      const team = await deps.teamRepo.findById(ws, body.teamId);
      if (!team) throw new AppError('VALIDATION_ERROR', 'Time invalido', 400);
    }
    const data = await deps.channelRepo.create(ws, body);
    return reply.code(201).send(successEnvelope(data));
  });

  app.get('/channels/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const doc = await deps.channelRepo.findById(ws, id);
    if (!doc) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);

    let team: { id: string; name: string } | undefined;
    if (doc.teamId) {
      const t = await deps.teamRepo.findById(ws, String(doc.teamId));
      if (t) team = { id: t.id, name: t.name };
    }

    const metrics =
      (doc.metrics as Record<string, unknown> | undefined) ??
      ({
        messagesLast24h: 1250,
        avgResponseTime: '1m 45s',
      } as Record<string, unknown>);

    const prov = (doc as { provider?: string }).provider;
    const plat = (doc as { platform?: string }).platform;
    const webhookUrl =
      prov === 'chat_sdk' && plat
        ? buildChatSdkWebhookUrl(req, ws, plat, doc._id.toString())
        : undefined;
    const secretsMasked = deps.channelSecretsService.secretsPreview(doc);
    return reply.send(
      successEnvelope({
        id: doc._id.toString(),
        type: doc.type,
        provider: prov === 'chat_sdk' ? 'chat_sdk' : 'native',
        platform: plat,
        name: doc.name,
        status: doc.status,
        teamId: doc.teamId ? String(doc.teamId) : undefined,
        team,
        config: (doc.config as Record<string, unknown>) ?? {},
        secretsMasked,
        webhookUrl,
        metrics,
        connectedAt: doc.connectedAt?.toISOString(),
      }),
    );
  });

  app.put('/channels/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const body = updateBody.parse(req.body);
    const existing = await deps.channelRepo.findById(ws, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    if (body.teamId) {
      const team = await deps.teamRepo.findById(ws, body.teamId);
      if (!team) throw new AppError('VALIDATION_ERROR', 'Time invalido', 400);
    }
    const mergedConfig =
      body.config !== undefined
        ? {
            ...((existing.config as Record<string, unknown>) ?? {}),
            ...body.config,
          }
        : undefined;
    const data = await deps.channelRepo.update(ws, id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.platform !== undefined ? { platform: body.platform } : {}),
      ...(mergedConfig !== undefined ? { config: mergedConfig } : {}),
    });
    if (!data) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.put('/channels/:id/secrets', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const raw = putSecretsBody.parse(req.body);
    const { platform, ...rest } = raw;
    const doc = await deps.channelRepo.findById(ws, id);
    if (!doc) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    const prov = (doc as { provider?: string }).provider;
    const plat = (doc as { platform?: string }).platform;
    if (prov !== 'chat_sdk' || plat !== platform) {
      throw new AppError('VALIDATION_ERROR', 'Plataforma do corpo deve coincidir com o canal chat_sdk', 400);
    }
    const payload = parseChatSdkSecretsBody(platform, { ...rest, platform });
    const encrypted = deps.channelSecretsService.encryptPayload(payload);
    const updated = await deps.channelRepo.setSecretsEncrypted(ws, id, encrypted);
    if (!updated) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    return reply.send(
      successEnvelope({
        id: updated._id.toString(),
        message: 'Segredos armazenados (cifrados)',
        secretsMasked: deps.channelSecretsService.secretsPreview(updated),
      }),
    );
  });

  app.post(
    '/channels/:id/telegram/register-webhook',
    { preHandler: [...tenant, requireAdmin()] },
    async (req, reply) => {
      const ws = req.workspaceId!;
      const id = (req.params as { id: string }).id;
      const doc = await deps.channelRepo.findById(ws, id);
      if (!doc) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
      const prov = (doc as { provider?: string }).provider;
      const plat = (doc as { platform?: string }).platform;
      if (prov !== 'chat_sdk' || plat !== 'telegram') {
        throw new AppError(
          'VALIDATION_ERROR',
          'Apenas canais Chat SDK com platform telegram',
          400,
        );
      }
      const plain = deps.channelSecretsService.decryptPayload(doc);
      if (!plain || plain.platform !== 'telegram') {
        throw new AppError(
          'VALIDATION_ERROR',
          'Segredos Telegram nao configurados para este canal',
          400,
        );
      }
      const webhookUrl = buildChatSdkWebhookUrl(req, ws, 'telegram', doc._id.toString());
      const { setWebhook, webhookInfo } = await registerTelegramWebhookWithTelegramApi(
        plain.botToken,
        webhookUrl,
        plain.secretToken,
      );
      if (!setWebhook.ok) {
        throw new AppError(
          'UPSTREAM_ERROR',
          setWebhook.description ?? 'setWebhook do Telegram falhou',
          502,
          { setWebhook, webhookUrl },
        );
      }
      return reply.send(
        successEnvelope({
          webhookUrl,
          setWebhook,
          webhookInfo,
        }),
      );
    },
  );

  app.delete('/channels/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const teams = await deps.teamRepo.findTeamsWithChannelId(ws, id);
    if (teams.length > 0) {
      throw new AppError(
        'CONFLICT',
        'Canal vinculado a um ou mais times; remova o canal dos times antes de excluir',
        409,
        { teams },
      );
    }
    const ok = await deps.channelRepo.delete(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    return reply.send(successEnvelope({ message: 'Canal removido com sucesso' }));
  });

  app.post('/channels/:id/connect', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const doc = await deps.channelRepo.findById(ws, id);
    if (!doc) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    const data = mockChannelConnect(doc.type);
    if (doc.type !== 'whatsapp') {
      await deps.channelRepo.markConnected(ws, id);
    }
    return reply.send(successEnvelope(data));
  });

  app.post('/channels/:id/disconnect', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const data = await deps.channelRepo.disconnect(ws, id);
    if (!data) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    return reply.send(successEnvelope(data));
  });

  app.post('/channels/:id/test', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = (req.params as { id: string }).id;
    const doc = await deps.channelRepo.findById(ws, id);
    if (!doc) throw new AppError('NOT_FOUND', 'Canal nao encontrado', 404);
    if (doc.status === 'disconnected') {
      throw new AppError('VALIDATION_ERROR', 'Canal desconectado', 400);
    }
    await deps.channelRepo.markConnected(ws, id);
    return reply.send(successEnvelope(mockChannelTest()));
  });
}
