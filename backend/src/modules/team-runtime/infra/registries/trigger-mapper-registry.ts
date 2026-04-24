import { z } from 'zod';
import type { ITeamInvocation } from '../../domain/team-invocation.js';

export const teamRunBodySchema = z.object({
  message: z.string().min(1),
  channel: z.string().optional(),
  locale: z.string().optional(),
  requestedAccessLevel: z.enum(['read', 'write', 'restricted']).optional(),
  taskType: z.string().optional(),
  /** Identidade estável da conversa (ex.: console de debug); histórico carregado no servidor. */
  conversationId: z.string().min(1).max(128).optional(),
});

export type ITeamRunBody = z.infer<typeof teamRunBodySchema>;

export type TTriggerMapper = (raw: unknown) => ITeamInvocation;

/**
 * Maps external payloads into TeamInvocation. Core runtime stays platform-agnostic.
 */
export class TriggerMapperRegistry {
  private readonly mappers = new Map<string, TTriggerMapper>();

  register(name: string, mapper: TTriggerMapper): void {
    this.mappers.set(name, mapper);
  }

  map(name: string, raw: unknown): ITeamInvocation {
    const fn = this.mappers.get(name);
    if (!fn) throw new Error(`Unknown trigger mapper: ${name}`);
    return fn(raw);
  }
}

/** Builds a manual/API invocation once team and coordinator are known from the DB. */
export function buildManualTeamInvocation(
  workspaceId: string,
  teamId: string,
  coordinatorId: string,
  body: ITeamRunBody,
  correlationId?: string,
  conversation?: ITeamInvocation['conversation'],
): ITeamInvocation {
  return {
    trigger: 'manual',
    workspaceId,
    teamId,
    coordinatorId,
    message: body.message,
    coordinatorExternalContext: {
      channelLabel: body.channel,
      locale: body.locale,
      taskType: body.taskType,
      requestedAccessLevel: body.requestedAccessLevel,
    },
    ...((correlationId || body.conversationId?.trim())
      ? {
          metadata: {
            ...(correlationId ? { correlationId } : {}),
            ...(body.conversationId?.trim() ? { conversationId: body.conversationId.trim() } : {}),
          },
        }
      : {}),
    ...(conversation ? { conversation } : {}),
  };
}

export function buildChatTeamInvocation(
  workspaceId: string,
  teamId: string,
  coordinatorId: string,
  message: string,
  channelLabel: string,
  options?: {
    /** Mesmo padrão do manual: referência e logs (ex. inbound + debug session). */
    conversationId?: string;
    /** Turnos anteriores persistidos; mensagem corrente é só `message` (não entra no histórico ainda). */
    conversation?: ITeamInvocation['conversation'];
  },
): ITeamInvocation {
  const convId = options?.conversationId?.trim();
  return {
    trigger: 'chat',
    workspaceId,
    teamId,
    coordinatorId,
    message,
    coordinatorExternalContext: { channelLabel },
    ...(convId ? { metadata: { conversationId: convId } } : {}),
    ...(options?.conversation ? { conversation: options.conversation } : {}),
  };
}
