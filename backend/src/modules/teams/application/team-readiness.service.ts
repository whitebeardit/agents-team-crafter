import { normalizeCatalogToolIds } from '../../agents/domain/available-tools.js';
import { resolveOperationalCatalogTools } from '../../agents/domain/operational-catalog-tools.js';
import type { IGraphEdge, IGraphNode } from '../../graphs/domain/graph-types.js';
import { validateTeamGraph } from '../../graphs/domain/graph-validator.js';
import {
  normalizeGraphNodesEntityFields,
  normalizePersistedChannelEdgesToCoordinator,
  stripDerivedGraphEdges,
} from '../../graphs/domain/graph-enrichment.js';
import type { IAppDeps } from '../../../config/container.js';
import type { ITeamReadinessItem, ITeamReadinessResult, TTeamReadinessLevel } from './team-readiness.types.js';

const CATALOG_NEEDING_INTEGRATION = new Set(['database_query', 'calendar_access', 'image_generation']);

export type TTeamReadinessDeps = Pick<
  IAppDeps,
  | 'teamRepo'
  | 'agentRepo'
  | 'channelRepo'
  | 'teamGraphRepo'
  | 'workspaceToolDefinitionRepo'
  | 'workspaceIntegrationsService'
>;

function rollLevel(items: ITeamReadinessItem[]): TTeamReadinessLevel {
  if (items.some((i) => i.severity === 'blocked')) return 'blocked';
  if (items.some((i) => i.severity === 'attention')) return 'attention';
  return 'ready';
}

function headlineFor(level: TTeamReadinessLevel): string {
  switch (level) {
    case 'blocked':
      return 'Existem bloqueios que impedem operar este time com confiança.';
    case 'attention':
      return 'O time pode operar, mas há pontos a rever antes de produção.';
    default:
      return 'Time pronto para operar com a configuração actual.';
  }
}

/**
 * Avaliação consolidada de prontidão (Loop 88): estado do time, agentes, grafo, canais,
 * integrações necessárias às tools de catálogo e definitions de negócio.
 */
export async function computeTeamReadiness(
  workspaceId: string,
  teamId: string,
  deps: TTeamReadinessDeps,
): Promise<ITeamReadinessResult> {
  const items: ITeamReadinessItem[] = [];
  const push = (i: ITeamReadinessItem) => items.push(i);

  const team = await deps.teamRepo.findById(workspaceId, teamId);
  if (!team) {
    return {
      level: 'blocked',
      headline: headlineFor('blocked'),
      items: [
        {
          code: 'team_not_found',
          severity: 'blocked',
          title: 'Time não encontrado',
          detail: 'O identificador do time não existe neste workspace.',
          nextStep: 'Verifique o URL ou volte à lista de times.',
          routeHint: '/teams',
          ctaLabel: 'Lista de times',
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  if (team.status === 'draft') {
    push({
      code: 'team_status_draft',
      severity: 'attention',
      title: 'Time em rascunho',
      detail: 'Times em rascunho não estão activos para canais externos.',
      nextStep: 'Active o time quando a configuração estiver final.',
      routeHint: `/teams/${teamId}?tab=overview`,
      ctaLabel: 'Gerir estado do time',
    });
  } else if (team.status === 'inactive') {
    push({
      code: 'team_status_inactive',
      severity: 'blocked',
      title: 'Time inactivo',
      detail: 'O time está desactivado e não deve receber tráfego de produção.',
      nextStep: 'Reactive o time em Gestão do time.',
      routeHint: `/teams/${teamId}?tab=overview`,
      ctaLabel: 'Reactivar time',
    });
  }

  const coord = await deps.agentRepo.findById(workspaceId, team.coordinatorId);
  if (!coord) {
    push({
      code: 'coordinator_missing',
      severity: 'blocked',
      title: 'Coordenador em falta',
      detail: 'O agente coordenador referenciado pelo time não existe.',
      nextStep: 'Seleccione um coordenador válido para o time.',
      routeHint: `/teams/${teamId}?tab=agents`,
      ctaLabel: 'Escolher coordenador',
    });
  } else if ((coord as { role?: string }).role !== 'coordinator') {
    push({
      code: 'coordinator_role_invalid',
      severity: 'blocked',
      title: 'Coordenador inválido',
      detail: 'O agente indicado como coordenador não tem função Coordenador.',
      nextStep: 'Atribua um agente com papel Coordenador.',
      routeHint: `/agents/${team.coordinatorId}`,
      ctaLabel: 'Abrir agente coordenador',
    });
  }

  const agentIdList = [team.coordinatorId, ...(team.agentIds ?? [])];
  const uniqueAgentIds = [...new Set(agentIdList)];
  for (const aid of uniqueAgentIds) {
    const exists = await deps.agentRepo.findById(workspaceId, aid);
    if (!exists) {
      push({
        code: 'team_agent_missing',
        severity: 'blocked',
        title: `Agente em falta (${aid.slice(0, 8)}…)`,
        detail: 'Um agente listado no time não existe no workspace.',
        nextStep: 'Remova o agente ou restaure-o em Agentes.',
        routeHint: '/agents',
        ctaLabel: 'Workspace — Agentes',
      });
    }
  }

  const integrationCtx = await deps.workspaceIntegrationsService.getToolIntegrationContext(workspaceId);
  const operationalIds = new Set(resolveOperationalCatalogTools(integrationCtx).map((t) => t.id));

  const catalogMissingIntegration = new Set<string>();
  for (const aid of uniqueAgentIds) {
    const agent = await deps.agentRepo.findById(workspaceId, aid);
    if (!agent) continue;
    const cap = (agent as { capabilities?: { tools?: string[]; customToolDefinitionIds?: string[] } })
      .capabilities;
    const rawTools = cap?.tools ?? [];
    const catalogIds = normalizeCatalogToolIds(rawTools);
    for (const tid of catalogIds) {
      if (!CATALOG_NEEDING_INTEGRATION.has(tid)) continue;
      if (!operationalIds.has(tid)) catalogMissingIntegration.add(tid);
    }
    const agentName = String((agent as { name?: string }).name ?? aid);
    const customIds = cap?.customToolDefinitionIds ?? [];
    for (const defId of customIds) {
      const def = await deps.workspaceToolDefinitionRepo.findById(workspaceId, defId);
      if (!def) {
        push({
          code: 'custom_definition_missing',
          severity: 'blocked',
          title: 'Tool definition inexistente',
          detail: `O agente «${agentName}» referencia a definition «${defId}», que não existe.`,
          nextStep: 'Crie ou associe uma tool definition válida.',
          routeHint: '/tool-definitions',
          ctaLabel: 'Abrir tools do workspace',
        });
      } else if (def.enabled === false) {
        push({
          code: 'custom_definition_disabled',
          severity: 'attention',
          title: 'Tool definition desactivada',
          detail: `«${def.name}» está desactivada mas está ligada ao agente «${agentName}».`,
          nextStep: 'Reactiva a definition ou remove-a das capabilities.',
          routeHint: '/tool-definitions',
          ctaLabel: 'Abrir definitions',
        });
      }
    }
  }

  if (catalogMissingIntegration.size > 0) {
    const sorted = [...catalogMissingIntegration].sort();
    push({
      code: 'catalog_tool_needs_integration',
      severity: 'attention',
      title: 'Integrações em falta para tools de catálogo',
      detail: `Estas tools estão activas em agentes mas sem integração configurada: ${sorted.join(', ')} (execução limitada ou stub).`,
      nextStep: 'Configure Postgres, calendário ou OpenAI em Configurações > Integrações, conforme cada tool.',
      routeHint: '/settings?tab=integrations',
      ctaLabel: 'Abrir integrações',
    });
  }

  const chIds = team.channelIds ?? [];
  for (const cid of chIds) {
    const ch = await deps.channelRepo.findById(workspaceId, cid);
    if (!ch) {
      push({
        code: 'channel_missing',
        severity: 'blocked',
        title: 'Canal em falta',
        detail: `O canal ${cid} associado ao time não existe.`,
        nextStep: 'Associe canais válidos ao time.',
        routeHint: `/teams/${teamId}?tab=channels`,
        ctaLabel: 'Canais do time',
      });
      continue;
    }
    const st = (ch as { status?: string }).status;
    if (st && st !== 'connected') {
      push({
        code: 'channel_not_connected',
        severity: 'attention',
        title: `Canal não ligado (${(ch as { name?: string }).name ?? cid})`,
        detail: `Estado actual: ${st}. Mensagens externas podem não chegar.`,
        nextStep: 'Complete a ligação do canal em Canais.',
        routeHint: `/teams/${teamId}?tab=channels`,
        ctaLabel: 'Ligar canal',
      });
    }
  }

  const g = await deps.teamGraphRepo.get(workspaceId, teamId);
  const enrichTeam = {
    coordinatorId: team.coordinatorId,
    agentIds: team.agentIds,
    channelIds: team.channelIds,
  };
  const normalizedNodes = normalizeGraphNodesEntityFields(g.nodes as IGraphNode[], enrichTeam);
  const workspaceAgentIds = await deps.agentRepo.listAllIds(workspaceId);
  const cleanEdges = stripDerivedGraphEdges(g.edges as IGraphEdge[]);
  const { edges: persistedFixed } = normalizePersistedChannelEdgesToCoordinator(
    normalizedNodes as IGraphNode[],
    cleanEdges,
    enrichTeam,
    { agentIds: workspaceAgentIds },
  );
  const channelIdsAll = await deps.channelRepo.listAllIds(workspaceId);
  const graphValidation = validateTeamGraph(
    normalizedNodes as IGraphNode[],
    persistedFixed,
    {
      agentIds: new Set(workspaceAgentIds),
      channelIds: new Set(channelIdsAll),
    },
    { team: enrichTeam },
  );
  if (!graphValidation.valid) {
    for (const err of graphValidation.errors) {
      push({
        code: `graph_${err.code}`,
        severity: 'blocked',
        title: 'Grafo inválido',
        detail: err.message,
        nextStep: 'Corrija o grafo do time (nós e arestas).',
        routeHint: `/teams/${teamId}/graph`,
        ctaLabel: 'Editor de grafo',
      });
    }
  }
  for (const w of graphValidation.warnings) {
    push({
      code: `graph_warn_${w.code}`,
      severity: 'attention',
      title: 'Aviso no grafo',
      detail: w.message,
      nextStep: 'Revê a topologia do time no editor de grafo.',
      routeHint: `/teams/${teamId}/graph`,
      ctaLabel: 'Rever grafo',
    });
  }

  const level = rollLevel(items);
  return {
    level,
    headline: headlineFor(level),
    items,
    checkedAt: new Date().toISOString(),
  };
}
