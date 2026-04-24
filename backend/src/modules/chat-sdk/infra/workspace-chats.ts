import { randomUUID } from 'node:crypto';
import { Chat, ConsoleLogger } from 'chat';
import type { Thread } from 'chat';
import { createSlackAdapter } from '@chat-adapter/slack';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { createTeamsAdapter } from '@chat-adapter/teams';
import { createTelegramAdapter } from '@chat-adapter/telegram';
import { createGoogleChatAdapter } from '@chat-adapter/gchat';
import { createGitHubAdapter } from '@chat-adapter/github';
import { createLinearAdapter } from '@chat-adapter/linear';
import { createWhatsAppAdapter } from '@chat-adapter/whatsapp';
import { createMemoryState } from '@chat-adapter/state-memory';
import { createRedisState } from '@chat-adapter/state-redis';
import type { IEnv } from '../../../config/env.js';
import type { IAppDeps } from '../../../config/container.js';
import type { ChannelDoc } from '../../channels/infra/channel.model.js';
import type { IChatSdkSecretsPayload } from '../../channels/domain/chat-sdk-secrets.schema.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { invokeTeam } from '../../team-runtime/application/invoke-team.service.js';
import { buildChatTeamInvocation } from '../../team-runtime/infra/registries/trigger-mapper-registry.js';
import { requireCoordinatorForChannelInstance } from '../application/resolve-inbound-coordinator.js';
import { postCoordinatorExternalResponse } from './post-coordinator-external-response.js';
import { startTelegramTypingLoop } from './telegram-typing-loop.js';
import { createTelegramInboundStatusDebouncer } from './telegram-inbound-status-debouncer.js';
import { buildInboundDebugConversationId } from './inbound-conversation-id.js';

function createStateAdapter(workspaceId: string, env: IEnv) {
  const logger = new ConsoleLogger('info', `[chat-sdk:${workspaceId}]`);
  if (env.REDIS_URL) {
    return createRedisState({ url: env.REDIS_URL, keyPrefix: `chat-sdk:${workspaceId}:`, logger });
  }
  return createMemoryState();
}

function bindInbound(
  chat: Chat,
  deps: IAppDeps,
  workspaceId: string,
  channelDoc: ChannelDoc,
  agentChannelLabel: string,
) {
  const channelIdStr = channelDoc._id.toString();
  const runInbound = async (text: string, thread: Thread) => {
    const { coordinatorId, teamId } = await requireCoordinatorForChannelInstance(
      deps.teamRepo,
      workspaceId,
      channelIdStr,
    );
    const conversationId = buildInboundDebugConversationId(agentChannelLabel, thread.id);
    const history = await deps.teamDebugSessionRepo.getRecentTurns(
      workspaceId,
      teamId,
      conversationId,
    );
    const conversation =
      history.length > 0 ? { id: conversationId, history } : undefined;
    const invocation = buildChatTeamInvocation(
      workspaceId,
      teamId,
      coordinatorId,
      text,
      agentChannelLabel,
      { conversationId, conversation },
    );
    const stopTyping = agentChannelLabel === 'telegram' ? startTelegramTypingLoop(thread) : undefined;
    const telegramStatusDebouncer =
      agentChannelLabel === 'telegram' ? createTelegramInboundStatusDebouncer(thread) : undefined;
    let streamRunId: string | undefined;
    const startedAt = new Date();
    try {
      deps.teamLiveBroadcaster.publish(workspaceId, teamId, {
        source: 'inbound',
        runId: randomUUID(),
        event: 'inboundUserMessage',
        data: {
          channel: agentChannelLabel,
          text,
          teamId,
          channelId: channelIdStr,
          workspaceId,
        },
      });
      const result = await invokeTeam(deps.coordinatorOrchestrator, invocation, {
        onProgress: (e) => {
          streamRunId = e.runId;
          deps.teamLiveBroadcaster.publishAgentStatus(workspaceId, teamId, 'inbound', e);
          telegramStatusDebouncer?.notifyFromProgress(e);
        },
        streamCoordinatorText: true,
        onCoordinatorTextDelta: (deltaText) => {
          if (!streamRunId) return;
          const payload = { text: deltaText, runId: streamRunId };
          deps.teamLiveBroadcaster.publish(workspaceId, teamId, {
            source: 'inbound',
            runId: streamRunId,
            event: 'coordinatorDelta',
            data: payload,
          });
        },
      });
      deps.teamLiveBroadcaster.publish(workspaceId, teamId, {
        source: 'inbound',
        runId: result.runId,
        event: 'runComplete',
        data: {
          runId: result.runId,
          teamId: result.teamId,
          coordinatorAgentId: result.coordinatorAgentId,
          externalResponse: result.externalResponse,
          specialistResults: result.specialistResults,
          events: result.events,
        },
      });
      const assistantText = result.externalResponse?.text?.trim() ?? '';
      await deps.teamDebugSessionRepo.appendExchange(
        workspaceId,
        teamId,
        conversationId,
        undefined,
        text,
        assistantText || '(sem texto)',
      );
      await deps.runRecorderService.recordCompleted({
        workspaceId,
        teamId,
        trigger: 'channel_inbound',
        source: 'inbound',
        channel: agentChannelLabel,
        correlationId:
          typeof invocation.metadata?.correlationId === 'string' ? invocation.metadata.correlationId : undefined,
        startedAt,
        result,
      });
      return result.externalResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
      const status = err instanceof AppError ? err.httpStatus : 500;
      await deps.runRecorderService.recordFailed({
        workspaceId,
        teamId,
        runId: streamRunId ?? randomUUID(),
        coordinatorAgentId: coordinatorId,
        trigger: 'channel_inbound',
        source: 'inbound',
        channel: agentChannelLabel,
        correlationId:
          typeof invocation.metadata?.correlationId === 'string' ? invocation.metadata.correlationId : undefined,
        startedAt,
        error: { code, message, status },
      });
      deps.teamLiveBroadcaster.publish(workspaceId, teamId, {
        source: 'inbound',
        runId: randomUUID(),
        event: 'error',
        data: { code, message, status },
      });
      throw err;
    } finally {
      telegramStatusDebouncer?.dispose();
      stopTyping?.();
    }
  };

  chat.onNewMention(async (thread, message) => {
    await thread.subscribe();
    const text = (message.text ?? '').trim();
    if (!text) return;
    const out = await runInbound(text, thread);
    try {
      await postCoordinatorExternalResponse(thread, out, agentChannelLabel);
    } catch (err) {
      console.error('[postCoordinatorExternalResponse] inbound failed', {
        platform: agentChannelLabel,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  });

  chat.onSubscribedMessage(async (thread, message) => {
    const text = (message.text ?? '').trim();
    if (!text) return;
    const out = await runInbound(text, thread);
    try {
      await postCoordinatorExternalResponse(thread, out, agentChannelLabel);
    } catch (err) {
      console.error('[postCoordinatorExternalResponse] inbound failed', {
        platform: agentChannelLabel,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  });
}

export function createSlackChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { signingSecret: string; botToken: string },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const adapter = createSlackAdapter({
    signingSecret: secrets.signingSecret,
    botToken: secrets.botToken || undefined,
    logger: new ConsoleLogger('info', '[slack-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { slack: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'slack');
  return chat;
}

export function createSlackVerificationChatFromSecrets(secrets: { signingSecret: string; botToken?: string }) {
  const adapter = createSlackAdapter({
    signingSecret: secrets.signingSecret,
    botToken: secrets.botToken || undefined,
    logger: new ConsoleLogger('info', '[slack-verify]'),
  });
  return new Chat({
    userName: 'team-agents',
    adapters: { slack: adapter },
    state: createMemoryState(),
  });
}

export function createDiscordChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { botToken: string; publicKey: string; applicationId?: string },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const adapter = createDiscordAdapter({
    botToken: secrets.botToken,
    publicKey: secrets.publicKey,
    applicationId: secrets.applicationId,
    logger: new ConsoleLogger('info', '[discord-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { discord: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'discord');
  return chat;
}

export function createTeamsChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { appId: string; appPassword: string; appTenantId?: string; appType?: 'MultiTenant' | 'SingleTenant' },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const adapter = createTeamsAdapter({
    appId: secrets.appId,
    appPassword: secrets.appPassword,
    appTenantId: secrets.appTenantId,
    appType: secrets.appType,
    logger: new ConsoleLogger('info', '[teams-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { teams: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'teams');
  return chat;
}

export function createTelegramChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { botToken: string; secretToken?: string },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const adapter = createTelegramAdapter({
    botToken: secrets.botToken,
    secretToken: secrets.secretToken,
    mode: 'webhook',
    logger: new ConsoleLogger('info', '[telegram-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { telegram: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'telegram');
  return chat;
}

export function createGchatChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { credentialsJson: string; googleChatProjectNumber?: string; impersonateUser?: string },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  let credentials: { client_email: string; private_key: string; project_id?: string };
  try {
    credentials = JSON.parse(secrets.credentialsJson) as typeof credentials;
  } catch {
    throw new Error('gchat credentialsJson invalido');
  }
  const adapter = createGoogleChatAdapter({
    credentials,
    googleChatProjectNumber: secrets.googleChatProjectNumber,
    impersonateUser: secrets.impersonateUser,
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    logger: new ConsoleLogger('info', '[gchat-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { gchat: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'gchat');
  return chat;
}

export function createGithubChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: {
    webhookSecret: string;
    token?: string;
    appId?: string;
    privateKey?: string;
    installationId?: number;
  },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const base = { webhookSecret: secrets.webhookSecret, logger: new ConsoleLogger('info', '[github-adapter]') };
  const adapter =
    secrets.token != null && secrets.token.length > 0
      ? createGitHubAdapter({ ...base, token: secrets.token })
      : secrets.appId != null &&
          secrets.privateKey != null &&
          secrets.installationId != null &&
          secrets.installationId > 0
        ? createGitHubAdapter({
            ...base,
            appId: secrets.appId,
            privateKey: secrets.privateKey,
            installationId: secrets.installationId,
          })
        : secrets.appId != null && secrets.privateKey != null
          ? createGitHubAdapter({
              ...base,
              appId: secrets.appId,
              privateKey: secrets.privateKey,
            })
          : createGitHubAdapter(base);
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { github: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'github');
  return chat;
}

export function createLinearChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: {
    webhookSecret: string;
    apiKey?: string;
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
  },
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const base = { webhookSecret: secrets.webhookSecret, logger: new ConsoleLogger('info', '[linear-adapter]') };
  const adapter =
    secrets.apiKey != null && secrets.apiKey.length > 0
      ? createLinearAdapter({ ...base, apiKey: secrets.apiKey })
      : secrets.accessToken != null && secrets.accessToken.length > 0
        ? createLinearAdapter({ ...base, accessToken: secrets.accessToken })
        : secrets.clientId != null && secrets.clientSecret != null
          ? createLinearAdapter({ ...base, clientId: secrets.clientId, clientSecret: secrets.clientSecret })
          : createLinearAdapter(base);
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { linear: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'linear');
  return chat;
}

export function createWhatsappChatFromSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  secrets: { accessToken: string; appSecret: string; verifyToken: string },
  phoneNumberId: string,
) {
  const config = (channelDoc.config as Record<string, unknown>) ?? {};
  const adapter = createWhatsAppAdapter({
    accessToken: secrets.accessToken,
    appSecret: secrets.appSecret,
    verifyToken: secrets.verifyToken,
    phoneNumberId,
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    logger: new ConsoleLogger('info', '[whatsapp-adapter]'),
  });
  const chat = new Chat({
    userName: typeof config.botUserName === 'string' ? config.botUserName : 'team-agents',
    adapters: { whatsapp: adapter },
    state: createStateAdapter(workspaceId, env),
  });
  bindInbound(chat, deps, workspaceId, channelDoc, 'whatsapp');
  return chat;
}

export function buildChatFromDecryptedSecrets(
  deps: IAppDeps,
  env: IEnv,
  workspaceId: string,
  channelDoc: ChannelDoc,
  plain: IChatSdkSecretsPayload,
) {
  const cfg = (channelDoc.config as Record<string, unknown>) ?? {};
  switch (plain.platform) {
    case 'slack':
      return createSlackChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'discord':
      return createDiscordChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'teams':
      return createTeamsChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'telegram':
      return createTelegramChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'gchat':
      return createGchatChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'github':
      return createGithubChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'linear':
      return createLinearChatFromSecrets(deps, env, workspaceId, channelDoc, plain);
    case 'whatsapp': {
      const pid =
        typeof cfg.whatsappPhoneNumberId === 'string' ? cfg.whatsappPhoneNumberId : '';
      if (!pid) throw new Error('config.whatsappPhoneNumberId obrigatorio para WhatsApp');
      return createWhatsappChatFromSecrets(deps, env, workspaceId, channelDoc, plain, pid);
    }
    default: {
      const _e: never = plain;
      throw new Error(`Plataforma nao suportada: ${JSON.stringify(_e)}`);
    }
  }
}
