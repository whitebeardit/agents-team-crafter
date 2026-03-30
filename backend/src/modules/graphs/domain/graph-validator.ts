import type { IGraphEdge, IGraphNode, IGraphValidationResult, IValidationIssue } from './graph-types.js';
import { computeAllDerivedEdges, isDerivedGraphEdge } from './graph-enrichment.js';
import type { ITeamGraphEnrichTeam } from './graph-enrichment.js';

export type { IGraphEdge, IGraphNode, IGraphValidationResult, IValidationIssue } from './graph-types.js';

export interface IValidateTeamGraphEnrich {
  team: ITeamGraphEnrichTeam;
}

function resolveAgentIdFromGraphNode(
  n: IGraphNode | undefined,
  ctx: { agentIds: Set<string> },
): string | undefined {
  if (!n || (n.type !== 'coordinator' && n.type !== 'specialist')) return undefined;
  const aid = n.data?.agentId;
  if (aid) return aid;
  if (ctx.agentIds.has(n.id)) return n.id;
  return undefined;
}

export function validateTeamGraph(
  nodes: IGraphNode[],
  edges: IGraphEdge[],
  ctx: { agentIds: Set<string>; channelIds: Set<string> },
  enrich?: IValidateTeamGraphEnrich,
): IGraphValidationResult {
  const warnings: IValidationIssue[] = [];
  const errors: IValidationIssue[] = [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const userEdges = edges.filter((e) => !isDerivedGraphEdge(e));
  for (const e of userEdges) {
    if (!nodeById.has(e.source)) {
      errors.push({ code: 'INVALID_EDGE', message: `Origem '${e.source}' inexistente` });
    }
    if (!nodeById.has(e.target)) {
      errors.push({ code: 'INVALID_EDGE', message: `Destino '${e.target}' inexistente` });
    }
  }

  if (enrich) {
    const coordAgentId = enrich.team.coordinatorId;
    for (const e of userEdges) {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      const srcIsChannel = src?.type === 'channel';
      const tgtIsChannel = tgt?.type === 'channel';
      if (!srcIsChannel && !tgtIsChannel) continue;
      if (srcIsChannel && tgtIsChannel) {
        errors.push({
          code: 'CHANNEL_EDGE_INVALID',
          message:
            'Aresta entre dois nos de canal nao e permitida. Canais do time ligam-se apenas ao coordenador.',
        });
        continue;
      }
      const agentNode = srcIsChannel ? tgt : src;
      const agentId = resolveAgentIdFromGraphNode(agentNode, ctx);
      if (agentId !== coordAgentId) {
        errors.push({
          code: 'CHANNEL_EDGE_INVALID',
          message:
            'Cada canal persistido no grafo deve ligar-se ao no do coordenador do time (entrada/saida externa). ' +
            `O coordenador esperado e o agente '${coordAgentId}'. Remova ligacoes de especialista para canal ou reconecte ao coordenador.`,
        });
      }
    }
  }

  const coordinators = nodes.filter((n) => n.type === 'coordinator');
  if (coordinators.length === 0) {
    errors.push({
      code: 'NO_COORDINATOR',
      message: 'O time precisa ter pelo menos um coordenador',
    });
  }

  const channelNodes = nodes.filter((n) => n.type === 'channel');
  if (channelNodes.length === 0) {
    warnings.push({
      code: 'NO_CHANNEL',
      message: 'O time nao possui canal de comunicacao configurado',
    });
  }

  for (const n of nodes) {
    if (n.type === 'coordinator' || n.type === 'specialist') {
      const aid = n.data?.agentId ?? (ctx.agentIds.has(n.id) ? n.id : undefined);
      if (!aid) {
        errors.push({
          code: 'MISSING_AGENT_REF',
          message: `No de agente '${n.id}' sem referencia a agente (data.agentId ou id valido)`,
        });
      } else if (!ctx.agentIds.has(aid)) {
        errors.push({
          code: 'INVALID_AGENT',
          message: `Agente '${aid}' invalido para o workspace`,
        });
      }
    }
    if (n.type === 'channel') {
      const cid = n.data?.channelId ?? (ctx.channelIds.has(n.id) ? n.id : undefined);
      if (!cid) {
        errors.push({
          code: 'MISSING_CHANNEL_REF',
          message: `No de canal '${n.id}' sem referencia a canal (data.channelId ou id valido)`,
        });
      } else if (!ctx.channelIds.has(cid)) {
        errors.push({
          code: 'INVALID_CHANNEL',
          message: `Canal '${cid}' invalido para o workspace`,
        });
      }
    }
  }

  const derived = enrich ? computeAllDerivedEdges(nodes, enrich.team) : [];
  const connectivityEdges: IGraphEdge[] = [...userEdges, ...derived];

  const adj = new Map<string, Set<string>>();
  for (const e of connectivityEdges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  const startIds = coordinators.map((c) => c.id);
  const visited = new Set<string>();
  const stack = [...startIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const neigh = adj.get(id);
    if (neigh) for (const n of neigh) if (!visited.has(n)) stack.push(n);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      errors.push({
        code: 'ORPHAN_NODE',
        message: `O no '${n.id}' nao esta conectado ao grafo`,
      });
    }
  }

  const valid = errors.length === 0;
  return { valid, warnings, errors };
}
