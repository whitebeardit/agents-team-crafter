import { AppError } from '../../../shared/errors/app-error.js';
import { assertWorkspaceQuotaDelta } from '../../workspaces/application/workspace-plan-limits.js';
import { validateTeamGraph } from '../../graphs/domain/graph-validator.js';
import type { IGraphNode } from '../../graphs/domain/graph-types.js';
import {
  normalizeGraphNodesEntityFields,
  normalizePersistedChannelEdgesToCoordinator,
  stripDerivedGraphEdges,
} from '../../graphs/domain/graph-enrichment.js';
import { assertActiveChannelBindingUnique } from './assert-active-channel-binding.js';
import { ensureCoordinatorSystemInstructionPolicy } from '../../agents/application/coordinator-system-instruction-policy.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import {
  orderedUniqueAgentIds,
  type TTeamExportChannelFullSnapshot,
} from './build-team-export.js';
import { mergeChannelSecretsIntoImportPayload } from './merge-channel-secrets-into-payload.js';
import type { IAppDeps } from '../../../config/container.js';
import type { TeamRepository } from '../infra/team.repository.js';
import type { TAgentExportPayload } from '../../agents/application/build-agent-export.js';
import { z } from 'zod';
import type { IEncryptedPayload } from '../../../utils/secrets-crypto.js';
import type { EOpenAiWorkspaceChatModel } from '../../../shared/kernel/openai-workspace-chat-models.js';

const mcpConnectionIdMapSchema = z.record(z.string().min(1), z.string().min(1));

export const teamImportBodySchema = z.object({
  /** Snapshot exportado por `GET /teams/:id/export` (v1/v2) ou enriquecido com `channelsFull` (v2). */
  payload: z.unknown(),
  mcpConnectionIdMap: mcpConnectionIdMapSchema.optional(),
  /**
   * Só aplica a `replace` (incl. substituição automática em `POST /teams/import` quando o `team.id`
   * do export já existe no workspace). Por defeito **true** para evitar agentes duplicados no catálogo.
   */
  retireReplacedAgents: z.boolean().optional().default(true),
  /**
   * Se `true`, `POST /teams/import` cria sempre um time novo, mesmo que `payload.team.id` exista
   * no workspace (duplicação intencional).
   */
  forceCreate: z.boolean().optional().default(false),
  /**
   * `legacyId` de canal (do export) → corpo de segredos Chat SDK (ex.: { platform, ... } depois de validado),
   * cifrado no servidor antes de criar o canal. Usado com templates e import sem ficheiro de segredos.
   */
  channelSecretPayloads: z.record(z.string().min(1), z.unknown()).optional(),
});

export type TTeamImportResult = {
  teamId: string;
  oldToNewAgentIds: Record<string, string>;
  oldToNewChannelIds: Record<string, string>;
  warnings: string[];
};

/**
 * `POST /teams/import`: se o export contém `team.id` e esse time ainda existe no workspace,
 * substitui o conteúdo em vez de criar outro (evita duplicar agentes). `forceCreate` força criação.
 */
export async function resolveTeamImportMode(
  teamRepo: Pick<TeamRepository, 'findById'>,
  workspaceId: string,
  payload: unknown,
  forceCreate: boolean,
): Promise<{ mode: 'create' | 'replace'; replaceTeamId?: string; autoResolvedReplace: boolean }> {
  if (forceCreate) return { mode: 'create', autoResolvedReplace: false };
  const p = payload as { team?: { id?: string } } | null;
  const tid = typeof p?.team?.id === 'string' ? p.team.id.trim() : '';
  if (!tid) return { mode: 'create', autoResolvedReplace: false };
  const existing = await teamRepo.findById(workspaceId, tid);
  if (existing) {
    return { mode: 'replace', replaceTeamId: tid, autoResolvedReplace: true };
  }
  return { mode: 'create', autoResolvedReplace: false };
}

const teamShapeSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    objective: z.string().optional(),
    status: z.enum(['active', 'draft', 'inactive']).optional(),
    coordinatorId: z.string().min(1),
    agentIds: z.array(z.string()).default([]),
    channelIds: z.array(z.string()).default([]),
    primaryChannel: z.string().optional().nullable(),
  })
  .passthrough();

export function parseExportPayload(
  raw: unknown,
):
  | { kind: 'ok'; value: { team: z.infer<typeof teamShapeSchema>; graph: { nodes: unknown[]; edges: unknown[] }; channels: { id: string; type: unknown; name: string; status: unknown }[]; channelsFull?: TTeamExportChannelFullSnapshot[]; agents: TAgentExportPayload[]; exportVersion: string } }
  | { kind: 'error'; message: string } {
  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return { kind: 'error', message: 'Payload invalido' };
  if (p['exportKind'] !== 'team' && p['exportKind'] !== 'template') {
    return { kind: 'error', message: 'exportKind deve ser "team" ou "template"' };
  }
  const ev = String(p['exportVersion'] ?? '1');
  if (ev !== '1' && ev !== '2') {
    return { kind: 'error', message: 'exportVersion nao suportado' };
  }
  const t = teamShapeSchema.safeParse(p['team']);
  if (!t.success) {
    return { kind: 'error', message: 'Documento de time invalido no export' };
  }
  const graph = p['graph'] as { nodes?: unknown[]; edges?: unknown[] } | undefined;
  const ch = p['channels'] as unknown;
  if (!Array.isArray(ch) || ch.length === 0) {
    if (((t.data.channelIds as string[] | undefined) ?? []).length > 0) {
      return { kind: 'error', message: 'Lista de canais (channels) vazia no export' };
    }
  }
  const channels = (Array.isArray(ch) ? ch : []).map((c) => {
    const row = c as Record<string, unknown>;
    return {
      id: String(row['id'] ?? ''),
      type: row['type'],
      name: String(row['name'] ?? ''),
      status: row['status'],
    };
  });
  const agents = p['agents'] as TAgentExportPayload[] | undefined;
  if (!Array.isArray(agents) || agents.length === 0) {
    return { kind: 'error', message: 'Agentes (agents) vazios no export' };
  }
  const channelsFull = p['channelsFull'] as TTeamExportChannelFullSnapshot[] | undefined;
  const chIds = (t.data.channelIds as string[]) ?? [];
  if (chIds.length > 0) {
    if (channelsFull && channelsFull.length > 0) {
      if (channelsFull.length !== chIds.length) {
        return { kind: 'error', message: 'channelsFull deve ter o mesmo comprimento que channelIds do time' };
      }
      for (let i = 0; i < chIds.length; i += 1) {
        if (String(channelsFull[i]?.legacyId) !== chIds[i]) {
          return {
            kind: 'error',
            message: 'Ordem ou legacyId de channelsFull nao coincide com channelIds do time',
          };
        }
      }
    } else if (ev === '1') {
      return {
        kind: 'error',
        message:
          'Export v1: reexporte o time (v2) para incluir `channelsFull`, ou use um ficheiro com snapshot completo de canais',
      };
    } else {
      return { kind: 'error', message: 'Canais completos (channelsFull) em falta no export v2' };
    }
  }
  return {
    kind: 'ok',
    value: {
      team: t.data,
      graph: { nodes: graph?.nodes ?? [], edges: graph?.edges ?? [] },
      channels,
      channelsFull,
      agents,
      exportVersion: ev,
    },
  };
}

function resolveMcpId(
  oldId: string,
  map: Record<string, string> | undefined,
  sameWorkspace: boolean,
): string {
  if (map && map[oldId]) return map[oldId];
  if (sameWorkspace) return oldId;
  if (!oldId) {
    throw new AppError('MCP_UNRESOLVED', 'mcpConnectionId vazio no export', 400, { mcpConnectionId: oldId });
  }
  throw new AppError(
    'MCP_UNRESOLVED',
    'Defina mcpConnectionIdMap no corpo (import noutro workspace) ou reimporte no workspace de origem',
    400,
    { mcpConnectionId: oldId },
  );
}

function remapGraphEntityIds(
  nodes: unknown[],
  agentIdMap: Map<string, string>,
  channelIdMap: Map<string, string>,
): unknown[] {
  return nodes.map((n) => {
    if (!n || typeof n !== 'object') return n;
    const node = { ...(n as Record<string, unknown>) };
    const data = node['data'] as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
      const d = { ...data };
      const aid = d['agentId'];
      if (typeof aid === 'string' && agentIdMap.has(aid)) d['agentId'] = agentIdMap.get(aid);
      const cid = d['channelId'];
      if (typeof cid === 'string' && channelIdMap.has(cid)) d['channelId'] = channelIdMap.get(cid);
      node['data'] = d;
    }
    return node;
  });
}

function buildAgentCreateBody(agentRecord: Record<string, unknown>, role: string) {
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = agentRecord;
  const base: Record<string, unknown> = {
    ...rest,
    origin: 'company',
    status: (rest['status'] as string) || 'active',
  };
  if (role === 'coordinator' || (rest['role'] as string) === 'coordinator') {
    const si = typeof rest['systemInstruction'] === 'string' ? rest['systemInstruction'] : '';
    base['systemInstruction'] = ensureCoordinatorSystemInstructionPolicy(si);
  }
  if (typeof rest['category'] === 'string') {
    base['category'] = normalizeAgentCategory(rest['category']);
  } else {
    base['category'] = normalizeAgentCategory('Geral');
  }
  if (!base['version']) base['version'] = '1.0.0';
  if (base['openaiRuntimeModel'] === null || base['openaiRuntimeModel'] === undefined) {
    delete base['openaiRuntimeModel'];
  }
  return base;
}

function toChannelSnapshotsFromExport(parsed: {
  team: { channelIds: string[] };
  channels: { id: string; type: unknown; name: string; status: unknown }[];
  channelsFull?: TTeamExportChannelFullSnapshot[];
}): TTeamExportChannelFullSnapshot[] {
  const { channelIds } = parsed.team;
  if (channelIds.length === 0) return [];
  const byLegacy = new Map(
    (parsed.channelsFull ?? []).map((c) => [c.legacyId, c] as [string, TTeamExportChannelFullSnapshot]),
  );
  const out: TTeamExportChannelFullSnapshot[] = [];
  for (const cid of channelIds) {
    const full = byLegacy.get(cid);
    if (full) {
      out.push(full);
      continue;
    }
    const small = parsed.channels.find((c) => c.id === cid);
    if (!small) {
      throw new AppError('IMPORT_CHANNEL_MISSING', `Canal ${cid} nao encontrado no export`, 400);
    }
    out.push({
      legacyId: small.id,
      type: small.type as TTeamExportChannelFullSnapshot['type'],
      name: small.name,
      status: (String(small.status) as 'connected' | 'disconnected' | 'pending') || 'pending',
      provider: 'native',
      config: {},
    });
  }
  return out;
}

/**
 * Importa time a partir de JSON (export v2 recomendado). `sameWorkspaceMcp` = true quando as ligações MCP
 * do export pertencem ao workspace actual (não muda IDs sem mapa).
 */
export async function importTeamFromExport(
  deps: IAppDeps,
  workspaceId: string,
  params: {
    mode: 'create' | 'replace';
    /** Obrigatório se `replace` */
    replaceTeamId?: string;
    /** Body parseado: payload + mcp map */
    importBody: z.infer<typeof teamImportBodySchema>;
    sameWorkspaceMcp: boolean;
  },
): Promise<TTeamImportResult> {
  const { payload, mcpConnectionIdMap, retireReplacedAgents, channelSecretPayloads } = params.importBody;
  let effectivePayload: unknown = payload;
  if (channelSecretPayloads && Object.keys(channelSecretPayloads).length > 0) {
    effectivePayload = mergeChannelSecretsIntoImportPayload(
      payload,
      channelSecretPayloads,
      deps.channelSecretsService,
    );
  }
  const parsed = parseExportPayload(effectivePayload);
  if (parsed.kind === 'error') {
    throw new AppError('IMPORT_PAYLOAD_INVALID', parsed.message, 400);
  }
  const { team: exTeam, graph, agents: exportAgents } = parsed.value;

  const coordId = exTeam.coordinatorId;
  const exAgentOrder = orderedUniqueAgentIds(coordId, exTeam.agentIds ?? []);
  if (exportAgents.length !== exAgentOrder.length) {
    throw new AppError('IMPORT_AGENTS_LENGTH', 'Numero de blocos de agente no export nao bate com o time', 400);
  }
  for (let i = 0; i < exAgentOrder.length; i += 1) {
    const a = (exportAgents[i]!.agent as Record<string, unknown>)['id'];
    if (String(a) !== exAgentOrder[i]) {
      throw new AppError(
        'IMPORT_AGENT_ORDER',
        'Ordem de agentes no export nao corresponde ao time (esperado coordenador + agents)',
        400,
      );
    }
  }
  if (String((exportAgents[0]!.agent as Record<string, unknown>)['role']) !== 'coordinator') {
    throw new AppError('IMPORT_COORDINATOR', 'O primeiro agente do export deve ser o coordenador', 400);
  }

  const warnings: string[] = [];
  const channelSnapshots = toChannelSnapshotsFromExport(parsed.value);

  const nAgents = exAgentOrder.length;
  const oldToNewChannelIds: Record<string, string> = {};
  const oldToNewAgentIds: Record<string, string> = {};
  /** Canais a criar: reutilizamos documentos existentes quando `findById(workspaceId, legacyId)` existe (import repetido / mesmo ID). */
  const snapshotsToCreate: TTeamExportChannelFullSnapshot[] = [];

  for (const snap of channelSnapshots) {
    const existing = await deps.channelRepo.findById(workspaceId, snap.legacyId);
    if (existing) {
      oldToNewChannelIds[snap.legacyId] = snap.legacyId;
    } else {
      snapshotsToCreate.push(snap);
    }
  }
  const channelsToCreate = snapshotsToCreate.length;

  if (params.mode === 'create') {
    await assertWorkspaceQuotaDelta(deps.settingsRepo, workspaceId, {
      teams: 1,
      agents: nAgents,
      channels: channelsToCreate,
    });
  } else {
    await assertWorkspaceQuotaDelta(deps.settingsRepo, workspaceId, {
      agents: nAgents,
      channels: channelsToCreate,
    });
  }

  let previousTeam: Record<string, unknown> | null = null;
  const exTeamIds: string[] = [];
  if (params.mode === 'replace') {
    const tid = params.replaceTeamId;
    if (!tid) throw new AppError('VALIDATION_ERROR', 'replaceTeamId e obrigatorio', 400);
    const t = await deps.teamRepo.findById(workspaceId, tid);
    if (!t) throw new AppError('NOT_FOUND', 'Time a substituir nao encontrado', 404);
    previousTeam = t as Record<string, unknown>;
    for (const aid of [
      String(previousTeam['coordinatorId'] ?? ''),
      ...((previousTeam['agentIds'] as string[]) ?? []),
    ]) {
      if (aid && !exTeamIds.includes(aid)) exTeamIds.push(aid);
    }
  }

  for (const snap of snapshotsToCreate) {
    if (!snap.secretsEncrypted) {
      warnings.push(
        `Canal ${snap.name} (${snap.legacyId}): importado sem segredos no ficheiro; pode ser necessario reconectar.`,
      );
    }
    const connectedAt = snap.connectedAt ? new Date(snap.connectedAt) : undefined;
    const disconnectedAt = snap.disconnectedAt ? new Date(snap.disconnectedAt) : undefined;
    const newId = await deps.channelRepo.createFromImportSnapshot(workspaceId, {
      type: snap.type,
      name: snap.name,
      status: snap.status,
      provider: snap.provider === 'chat_sdk' ? 'chat_sdk' : 'native',
      platform: snap.platform,
      config: snap.config ?? {},
      teamId: undefined,
      metrics: snap.metrics,
      connectedAt,
      disconnectedAt,
      secretsEncrypted: snap.secretsEncrypted
        ? (snap.secretsEncrypted as unknown as IEncryptedPayload)
        : undefined,
    });
    oldToNewChannelIds[snap.legacyId] = newId;
  }

  for (const exp of exportAgents) {
    const a = exp.agent as Record<string, unknown>;
    const oldId = String(a['id'] ?? '');
    const role = String(a['role'] ?? 'specialist');
    if (deps.workspaceIntegrationsService && a['openaiRuntimeModel']) {
      const m = a['openaiRuntimeModel'] as string;
      if (m) {
        try {
          await deps.workspaceIntegrationsService.assertAgentRuntimeModelAllowed(
            workspaceId,
            m as EOpenAiWorkspaceChatModel,
          );
        } catch (e) {
          delete a['openaiRuntimeModel'];
          warnings.push(`Modelo removido para o agente ${a['name'] ?? oldId} (plano/integracoes nao permitem: ${m}).`);
        }
      }
    }
    const body = buildAgentCreateBody(a, role);
    const created = await deps.agentRepo.create(workspaceId, body);
    oldToNewAgentIds[oldId] = (created as { id: string }).id;
  }

  const newCoord = oldToNewAgentIds[coordId];
  if (!newCoord) {
    throw new AppError('INTERNAL', 'Falha ao mapear coordenador', 500);
  }
  const newAgentIdList = (exTeam.agentIds as string[]).map((o) => {
    const n = oldToNewAgentIds[o];
    if (!n) throw new AppError('INTERNAL', `Falha ao mapear agente ${o}`, 500);
    return n;
  });
  const newChannelIdList = (exTeam.channelIds as string[]).map((o) => {
    const n = oldToNewChannelIds[o];
    if (!n) throw new AppError('INTERNAL', `Falha ao mapear canal ${o}`, 500);
    return n;
  });

  const name = exTeam.name;
  const description = (exTeam.description as string) ?? '';
  const objective = exTeam.objective as string | undefined;
  const status = (exTeam.status as string) ?? 'draft';
  const primary = exTeam.primaryChannel != null ? String(exTeam.primaryChannel) : undefined;

  let finalTeamId: string;

  if (params.mode === 'create') {
    const createdT = await deps.teamRepo.create(workspaceId, {
      name,
      description,
      objective,
      coordinatorId: newCoord,
      agentIds: newAgentIdList,
      channelIds: newChannelIdList,
      primaryChannel: primary,
      status: status === 'active' ? 'draft' : (status as 'active' | 'draft' | 'inactive'),
    });
    finalTeamId = (createdT as { id: string }).id;
  } else {
    const tid = params.replaceTeamId ?? '';
    const up = await deps.teamRepo.update(workspaceId, tid, {
      name,
      description,
      objective,
      coordinatorId: newCoord,
      agentIds: newAgentIdList,
      channelIds: newChannelIdList,
      primaryChannel: primary,
      status: status === 'active' ? 'draft' : (status as 'active' | 'draft' | 'inactive'),
    } as unknown as Record<string, unknown>);
    if (!up) throw new AppError('NOT_FOUND', 'Time a substituir nao encontrado', 404);
    finalTeamId = (up as { id: string }).id;
  }

  for (const oc of Object.keys(oldToNewChannelIds)) {
    const nid = oldToNewChannelIds[oc]!;
    await deps.channelRepo.update(workspaceId, nid, { teamId: finalTeamId });
  }

  const mapAgent = new Map(Object.entries(oldToNewAgentIds)) as Map<string, string>;
  const mapCh = new Map(Object.entries(oldToNewChannelIds)) as Map<string, string>;
  for (const exp of exportAgents) {
    const newAid = oldToNewAgentIds[String((exp.agent as Record<string, unknown>)['id'])]!;
    const mcpBinds = (exp as { mcpBindings?: Array<Record<string, unknown>> }).mcpBindings ?? [];
    for (const b of mcpBinds) {
      const oldMcp = String(b['mcpConnectionId'] ?? '');
      if (!oldMcp) continue;
      const mcpId = resolveMcpId(oldMcp, mcpConnectionIdMap, params.sameWorkspaceMcp);
      const conn = await deps.mcpRepo.findById(workspaceId, mcpId);
      if (!conn) {
        warnings.push(
          `Ligacao MCP ${mcpId} inexistente — ignorada (use mcpConnectionIdMap) para agente ${newAid}.`,
        );
        continue;
      }
      const tools = (b['allowedTools'] as string[] | undefined) ?? [];
      const r = await deps.agentMcpBindingRepo.create(workspaceId, newAid, {
        mcpConnectionId: mcpId,
        allowedTools: tools,
        requiresApproval: Boolean(b['requiresApproval'] ?? false),
      });
      if (r && 'error' in r) {
        warnings.push(
          `MCP ${mcpId}: tool invalida — ${(r as { error: string; tool: string }).tool ?? ''}.`,
        );
      }
    }
  }

  const remapped = remapGraphEntityIds(graph.nodes, mapAgent, mapCh);
  const teamRow = (await deps.teamRepo.findById(workspaceId, finalTeamId)) as Record<string, unknown> | null;
  if (!teamRow) throw new AppError('NOT_FOUND', 'Time nao encontrado', 500);
  const enrichTeam = {
    coordinatorId: String(teamRow['coordinatorId'] ?? newCoord),
    agentIds: (teamRow['agentIds'] as string[]) ?? newAgentIdList,
    channelIds: (teamRow['channelIds'] as string[]) ?? newChannelIdList,
  };
  const normalizedNodes = normalizeGraphNodesEntityFields(remapped, enrichTeam) as IGraphNode[];
  const cleanEdges = stripDerivedGraphEdges(graph.edges);
  const agentIds = await deps.agentRepo.listAllIds(workspaceId);
  const channelIds = await deps.channelRepo.listAllIds(workspaceId);
  const { edges: edgesToPersist } = normalizePersistedChannelEdgesToCoordinator(
    normalizedNodes,
    cleanEdges,
    enrichTeam,
    { agentIds },
  );
  const graphValidation = validateTeamGraph(
    normalizedNodes,
    edgesToPersist,
    { agentIds, channelIds },
    { team: enrichTeam },
  );
  if (!graphValidation.valid) {
    throw new AppError(
      'VALIDATION_ERROR',
      graphValidation.errors.map((e) => e.message).join(' '),
      400,
    );
  }
  await deps.teamGraphRepo.upsert(
    workspaceId,
    finalTeamId,
    normalizedNodes as unknown[],
    edgesToPersist as unknown as unknown[],
  );

  if (status === 'active') {
    try {
      await assertActiveChannelBindingUnique(deps.teamRepo, workspaceId, newChannelIdList, finalTeamId);
      await deps.teamRepo.update(workspaceId, finalTeamId, { status: 'active' } as Record<string, unknown>);
    } catch (e) {
      if (e instanceof AppError) {
        warnings.push(`Time em draft: ${(e as AppError).message}.`);
        await deps.teamRepo.update(workspaceId, finalTeamId, { status: 'draft' } as Record<string, unknown>);
      } else {
        throw e;
      }
    }
  } else {
    const st = (status as 'active' | 'draft' | 'inactive') || 'draft';
    await deps.teamRepo.update(workspaceId, finalTeamId, { status: st } as Record<string, unknown>);
  }

  if (retireReplacedAgents && previousTeam && params.replaceTeamId) {
    const toRetire = new Set(
      [String(previousTeam['coordinatorId'] ?? ''), ...((previousTeam['agentIds'] as string[]) ?? [])].filter(
        Boolean,
      ),
    );
    for (const oldA of toRetire) {
      const refs = await deps.teamRepo.findTeamsReferencingAgent(workspaceId, oldA);
      const other = refs.filter((r) => r.id !== params.replaceTeamId);
      if (other.length === 0) {
        await deps.agentRepo.softDelete(workspaceId, oldA);
      }
    }
  }

  return {
    teamId: finalTeamId,
    oldToNewAgentIds,
    oldToNewChannelIds,
    warnings,
  };
}
