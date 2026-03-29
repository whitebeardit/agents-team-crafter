import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RawServerDefault } from 'fastify';
import { Types } from 'mongoose';
import type { IEnv } from '../../../config/env.js';
import type { IAppDeps } from '../../../config/container.js';
import {
  buildChatFromDecryptedSecrets,
  createSlackVerificationChatFromSecrets,
} from '../infra/workspace-chats.js';
import { resolveSlackSecretsForChannel } from '../application/resolve-slack-secrets.js';
import type { EChatSdkPlatform } from '../../channels/domain/chat-sdk-platform.js';

type ReqWithRaw = FastifyRequest & { rawBody?: Buffer };

const PLATFORMS_WITH_CHANNEL_ID = [
  'discord',
  'teams',
  'telegram',
  'gchat',
  'github',
  'linear',
  'whatsapp',
] as const satisfies readonly EChatSdkPlatform[];

function isPlatformWithChannelId(s: string): s is (typeof PLATFORMS_WITH_CHANNEL_ID)[number] {
  return (PLATFORMS_WITH_CHANNEL_ID as readonly string[]).includes(s);
}

function toWebRequest(req: FastifyRequest, rawBody: Buffer): Request {
  const host = req.headers.host ?? 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const url = `${proto}://${host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) headers.set(k, v.join(','));
    else headers.set(k, v);
  }
  return new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : new Uint8Array(rawBody),
  });
}

async function forwardWebResponse(res: Response, reply: FastifyReply) {
  reply.status(res.status);
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    void reply.header(key, value);
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return reply.send(buf);
}

async function handleChatSdkByChannelId(
  req: FastifyRequest,
  reply: FastifyReply,
  env: IEnv,
  d: IAppDeps,
  workspaceId: string,
  platform: (typeof PLATFORMS_WITH_CHANNEL_ID)[number],
  channelId: string,
) {
  const rawBody =
    (req as ReqWithRaw).rawBody ??
    (req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : undefined);
  if (!rawBody && req.method !== 'GET' && req.method !== 'HEAD') {
    return reply.status(400).send({ error: 'raw body ausente' });
  }

  const channelDoc = await d.channelRepo.findById(workspaceId, channelId);
  if (!channelDoc) {
    return reply.status(404).send({ error: 'canal nao encontrado' });
  }
  const prov = (channelDoc as { provider?: string }).provider;
  const plat = (channelDoc as { platform?: string }).platform;
  if (prov !== 'chat_sdk' || plat !== platform) {
    return reply.status(404).send({ error: 'canal incompativel' });
  }

  const plain = d.channelSecretsService.decryptPayload(channelDoc);
  if (!plain || plain.platform !== platform) {
    req.log.warn({ workspaceId, channelId, platform }, 'segredos ausentes ou plataforma divergente');
    return reply.status(503).send({ error: 'segredos nao configurados para este canal' });
  }

  const chat = buildChatFromDecryptedSecrets(d, env, workspaceId, channelDoc, plain);
  const bodyBuf =
    req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : (rawBody as Buffer);
  const webReq = toWebRequest(req, bodyBuf);
  const res = await invokePlatformWebhook(chat, platform, webReq);
  return forwardWebResponse(res, reply);
}

async function invokePlatformWebhook(
  chat: ReturnType<typeof buildChatFromDecryptedSecrets>,
  platform: EChatSdkPlatform,
  webReq: Request,
): Promise<Response> {
  const wh = chat.webhooks as unknown as Record<string, (r: Request) => Promise<Response>>;
  const fn = wh[platform];
  if (typeof fn !== 'function') {
    throw new Error(`webhook nao exposto para plataforma: ${platform}`);
  }
  return fn(webReq);
}

/**
 * Rotas públicas de webhook (sem JWT). Prefixo esperado: `/api/v1/webhooks/chat`.
 * Slack: `POST /:workspaceId/slack` (roteamento por team_id no payload).
 * Demais: `GET|POST /:workspaceId/:platform/:channelId` (id do documento Channel).
 */
export async function registerChatWebhookRoutes(
  scoped: FastifyInstance<RawServerDefault>,
  env: IEnv,
  d: IAppDeps,
) {
  await scoped.register(
    async (instance) => {
      instance.addContentTypeParser(
        'application/json',
        { parseAs: 'buffer' },
        (req, body: Buffer, done) => {
          (req as ReqWithRaw).rawBody = body;
          try {
            const json = body.length === 0 ? {} : (JSON.parse(body.toString('utf8')) as unknown);
            done(null, json);
          } catch (e) {
            done(e as Error, undefined);
          }
        },
      );

      /** Slack Events API — sem channelId na URL. */
      instance.post('/:workspaceId/slack', async (req, reply) => {
        const workspaceId = (req.params as { workspaceId: string }).workspaceId;
        if (!Types.ObjectId.isValid(workspaceId)) {
          return reply.status(400).send({ error: 'workspaceId invalido' });
        }

        const rawBody = (req as ReqWithRaw).rawBody;
        if (!rawBody) {
          return reply.status(400).send({ error: 'raw body ausente' });
        }

        const workspaceSlackFallback =
          await d.workspaceIntegrationsService.getPlainSlackWorkspace(workspaceId);

        const skipVerify = env.CHAT_SDK_SKIP_SIGNATURE_VERIFY === '1' && env.NODE_ENV === 'test';
        const payload = req.body as Record<string, unknown>;

        const tryVerification = async (secrets: { signingSecret: string; botToken?: string }) => {
          const verifyChat = createSlackVerificationChatFromSecrets(secrets);
          const webReq = toWebRequest(req, rawBody);
          return verifyChat.webhooks.slack(webReq);
        };

        if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
          if (skipVerify) {
            const res = await tryVerification({
              signingSecret: 'test-slack-signing-secret',
              botToken: process.env.SLACK_BOT_TOKEN || undefined,
            });
            return forwardWebResponse(res, reply);
          }
          if (env.SLACK_SIGNING_SECRET) {
            const res = await tryVerification({
              signingSecret: env.SLACK_SIGNING_SECRET,
              botToken: process.env.SLACK_BOT_TOKEN || undefined,
            });
            return forwardWebResponse(res, reply);
          }
          const slackChannels = await d.channelRepo.listChatSdkByPlatform(workspaceId, 'slack');
          if (workspaceSlackFallback) {
            const res = await tryVerification(workspaceSlackFallback);
            if (res.status < 400) {
              return forwardWebResponse(res, reply);
            }
          }
          for (const ch of slackChannels) {
            const s = resolveSlackSecretsForChannel(
              ch,
              env,
              d.channelSecretsService,
              workspaceSlackFallback,
            );
            if (!s) continue;
            const res = await tryVerification({ signingSecret: s.signingSecret, botToken: s.botToken });
            if (res.status < 400) {
              return forwardWebResponse(res, reply);
            }
          }
          req.log.warn('url_verification: nenhum segredo Slack valido');
          return reply.status(503).send({ error: 'Slack webhook nao configurado' });
        }

        if (!skipVerify && !env.SLACK_SIGNING_SECRET) {
          const hasAny =
            Boolean(workspaceSlackFallback) ||
            (await d.channelRepo.listChatSdkByPlatform(workspaceId, 'slack')).some((ch) =>
              resolveSlackSecretsForChannel(
                ch,
                env,
                d.channelSecretsService,
                workspaceSlackFallback,
              ),
            );
          if (!hasAny) {
            req.log.warn('SLACK_SIGNING_SECRET nao configurada; webhook Slack desativado');
            return reply.status(503).send({ error: 'Slack webhook nao configurado' });
          }
        }

        if (payload.type === 'event_callback') {
          const teamId = typeof payload.team_id === 'string' ? payload.team_id : '';
          if (!teamId) {
            return reply.status(200).send();
          }
          const channelDoc = await d.channelRepo.findByWorkspaceAndSlackTeamId(workspaceId, teamId);
          if (!channelDoc) {
            req.log.warn({ workspaceId, teamId }, 'slack: sem Channel com config.slackTeamId');
            return reply.status(200).send();
          }

          const slackSecrets = skipVerify
            ? { signingSecret: 'test-slack-signing-secret', botToken: process.env.SLACK_BOT_TOKEN ?? '' }
            : resolveSlackSecretsForChannel(
                channelDoc,
                env,
                d.channelSecretsService,
                workspaceSlackFallback,
              );
          if (!slackSecrets) {
            req.log.warn({ workspaceId, teamId }, 'slack: segredos nao resolviveis');
            return reply.status(503).send({ error: 'Segredos Slack nao configurados' });
          }

          const { createSlackChatFromSecrets } = await import('../infra/workspace-chats.js');
          const chat = createSlackChatFromSecrets(d, env, workspaceId, channelDoc, slackSecrets);
          const webReq = toWebRequest(req, rawBody);
          const res = await chat.webhooks.slack(webReq);
          return forwardWebResponse(res, reply);
        }

        const fallbackSecrets = skipVerify
          ? { signingSecret: 'test-slack-signing-secret', botToken: process.env.SLACK_BOT_TOKEN || undefined }
          : env.SLACK_SIGNING_SECRET
            ? { signingSecret: env.SLACK_SIGNING_SECRET, botToken: process.env.SLACK_BOT_TOKEN || undefined }
            : null;
        if (fallbackSecrets) {
          const res = await tryVerification(fallbackSecrets);
          return forwardWebResponse(res, reply);
        }
        const slackChannels = await d.channelRepo.listChatSdkByPlatform(workspaceId, 'slack');
        if (workspaceSlackFallback) {
          const res = await tryVerification(workspaceSlackFallback);
          if (res.status < 400) return forwardWebResponse(res, reply);
        }
        for (const ch of slackChannels) {
          const s = resolveSlackSecretsForChannel(
            ch,
            env,
            d.channelSecretsService,
            workspaceSlackFallback,
          );
          if (!s) continue;
          const res = await tryVerification({ signingSecret: s.signingSecret, botToken: s.botToken });
          if (res.status < 400) return forwardWebResponse(res, reply);
        }
        return reply.status(503).send({ error: 'Slack webhook nao configurado' });
      });

      for (const platform of PLATFORMS_WITH_CHANNEL_ID) {
        instance.route({
          method: platform === 'whatsapp' ? ['GET', 'POST'] : ['POST'],
          url: `/:workspaceId/${platform}/:channelId`,
          handler: async (req, reply) => {
            const { workspaceId, channelId } = req.params as {
              workspaceId: string;
              channelId: string;
            };
            if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(channelId)) {
              return reply.status(400).send({ error: 'ids invalidos' });
            }
            if (!isPlatformWithChannelId(platform)) {
              return reply.status(400).send({ error: 'plataforma invalida' });
            }
            return handleChatSdkByChannelId(req, reply, env, d, workspaceId, platform, channelId);
          },
        });
      }
    },
    { prefix: '/webhooks/chat' },
  );
}
