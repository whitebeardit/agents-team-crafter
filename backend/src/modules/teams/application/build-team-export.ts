import type { AgentMcpBindingRepository } from '../../agents/infra/agent-mcp-binding.repository.js';
import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import {
  AGENT_EXPORT_VERSION,
  buildAgentExportPayload,
  type TAgentExportPayload,
} from '../../agents/application/build-agent-export.js';
import type { ChannelRepository } from '../../channels/infra/channel.repository.js';
import type { TeamGraphRepository } from '../../graphs/infra/team-graph.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TeamRepository } from '../infra/team.repository.js';

function toChannelRow(c: Record<string, unknown>) {
  const raw = c['_id'] as { toString(): string } | string | undefined;
  const id = typeof raw === 'object' && raw && 'toString' in raw ? raw.toString() : String(raw ?? '');
  return {
    id,
    type: c['type'],
    name: c['name'],
    status: c['status'],
  };
}

/**
 * Snapshot serializável do canal (sem _id/workspaceId/teamId/timestamps) — usado no import.
 */
export function toChannelFullSnapshot(
  c: Record<string, unknown>,
): TTeamExportChannelFullSnapshot {
  const raw = c['_id'] as { toString(): string } | string | undefined;
  const legacyId =
    typeof raw === 'object' && raw && 'toString' in raw ? raw.toString() : String(raw ?? '');

  return {
    legacyId,
    type: c['type'] as TTeamExportChannelFullSnapshot['type'],
    name: String(c['name'] ?? ''),
    status: c['status'] as TTeamExportChannelFullSnapshot['status'],
    provider: (c['provider'] as 'native' | 'chat_sdk' | undefined) ?? 'native',
    platform: c['platform'] as string | undefined,
    config: (c['config'] as Record<string, unknown>) ?? {},
    secretsEncrypted: c['secretsEncrypted'] as TTeamExportChannelFullSnapshot['secretsEncrypted'],
    metrics: c['metrics'] as Record<string, unknown> | undefined,
    connectedAt: toIso(c['connectedAt']),
    disconnectedAt: toIso(c['disconnectedAt']),
  };
}

function toIso(d: unknown): string | undefined {
  if (d == null) return undefined;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && d && 'toISOString' in d && typeof (d as Date).toISOString === 'function') {
    return (d as Date).toISOString();
  }
  return undefined;
}

/** Linha mínima + snapshot completo (v2) para reidratar o canal. */
export type TTeamExportChannelFullSnapshot = {
  legacyId: string;
  type: import('../../channels/infra/channel.model.js').ChannelDoc['type'];
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  provider: 'native' | 'chat_sdk';
  platform?: string;
  config: Record<string, unknown>;
  secretsEncrypted?: {
    algorithm: string;
    keyVersion: number;
    iv: string;
    ciphertext: string;
    authTag: string;
  };
  metrics?: Record<string, unknown>;
  connectedAt?: string;
  disconnectedAt?: string;
  /** Marcado em exports `template` quando o canal original tinha segredos (pedir de novo no import). */
  secretRequired?: boolean;
};

export function orderedUniqueAgentIds(coordinatorId: string, agentIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [coordinatorId, ...agentIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export type TTeamExportPayload = {
  exportVersion: string;
  exportKind: 'team';
  exportedAt: string;
  team: Record<string, unknown>;
  graph: { nodes: unknown[]; edges: unknown[] };
  channels: ReturnType<typeof toChannelRow>[];
  /** v2: dados completos de cada canal, alinhado com `channels` pela ordem. */
  channelsFull?: TTeamExportChannelFullSnapshot[];
  agents: TAgentExportPayload[];
};

export type TTeamExportDeps = {
  agentRepo: AgentRepository;
  teamRepo: TeamRepository;
  teamGraphRepo: TeamGraphRepository;
  channelRepo: ChannelRepository;
  agentMcpBindingRepo: AgentMcpBindingRepository;
};

export async function buildTeamExportPayload(
  deps: TTeamExportDeps,
  workspaceId: string,
  teamId: string,
): Promise<TTeamExportPayload> {
  const team = await deps.teamRepo.findById(workspaceId, teamId);
  if (!team) {
    throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
  }
  const t = team as Record<string, unknown>;
  const coordId = String(t['coordinatorId'] ?? '');
  const agentIds = (t['agentIds'] as string[]) ?? [];
  const channelIds = (t['channelIds'] as string[]) ?? [];
  const ordered = orderedUniqueAgentIds(coordId, agentIds);

  const graph = await deps.teamGraphRepo.get(workspaceId, teamId);
  const chRows = await deps.channelRepo.listByIds(workspaceId, channelIds);
  const channels = (chRows as Record<string, unknown>[]).map(toChannelRow);
  const channelsFull = (chRows as Record<string, unknown>[]).map(toChannelFullSnapshot);

  const missing: string[] = [];
  const agents: TAgentExportPayload[] = [];
  for (const aid of ordered) {
    const ag = await deps.agentRepo.findById(workspaceId, aid);
    if (!ag) {
      missing.push(aid);
    } else {
      const mcp = await deps.agentMcpBindingRepo.listByAgent(workspaceId, aid);
      agents.push(buildAgentExportPayload(ag as Record<string, unknown>, mcp));
    }
  }
  if (missing.length > 0) {
    throw new AppError('AGENT_REFS_INCOMPLETE', 'Um ou mais agentes referenciados pelo time nao existem', 422, {
      missingAgentIds: missing,
    });
  }

  return {
    exportVersion: AGENT_EXPORT_VERSION,
    exportKind: 'team',
    exportedAt: new Date().toISOString(),
    team: t,
    graph: { nodes: graph.nodes ?? [], edges: graph.edges ?? [] },
    channels,
    channelsFull,
    agents,
  };
}
