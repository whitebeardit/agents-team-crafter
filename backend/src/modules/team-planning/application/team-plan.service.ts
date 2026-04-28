import { z } from 'zod';
import pino from 'pino';
import { AppError } from '../../../shared/errors/app-error.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import { validateTeamGraph } from '../../graphs/domain/graph-validator.js';
import { assertActiveChannelBindingUnique } from '../../teams/application/assert-active-channel-binding.js';
import type { IAppDeps } from '../../../config/container.js';
import type { IGraphNode } from '../../graphs/domain/graph-types.js';
import type { TeamPlanRepository } from '../infra/team-plan.repository.js';
import { fetchTeamPlanJsonCompletion } from './team-plan-json-completion.js';
import {
  type ITeamPlannerStructuredBriefing,
  TEAM_PLANNER_REPAIR_SYSTEM_PROMPT,
  TEAM_PLANNER_SYSTEM_PROMPT,
  buildTeamPlannerRepairUserMessage,
  buildTeamPlannerUserMessage,
} from './team-plan-planner-prompt.js';
import { evaluateTeamPlanBriefingSufficiency } from './team-plan-briefing-sufficiency.js';
import { evaluateTeamPlanAdequacy } from './team-plan-adequacy-gate.js';
import { ensureCoordinatorSystemInstructionPolicy } from '../../agents/application/coordinator-system-instruction-policy.js';
import { buildTeamPlanIntegrityModel } from './team-plan-integrity-model.js';
import type { IAgentGovernanceDraft } from '../../agent-governance/domain/agent-governance.types.js';
import { getWorkspaceOverlapMode } from '../../governance/application/workspace-overlap-mode.js';
import {
  actionIdToToolSlug,
  computePlannerBindActionUniverse,
  mergePlannerPackIdsForBind,
  PLANNER_PACK_TO_ACTION_IDS,
} from './planner-pack-presets.js';
import { ensureInternalActionDefinitions } from './ensure-planner-tool-definitions.js';
import { recordTeamPlanAutoBindMetrics, startTeamPlanExecuteMetrics } from '../../../app/metrics.js';
import { resolveTeamPlanAutoBindPolicy } from './team-plan-auto-bind-policy.js';
import { assertWorkspaceQuotaDelta } from '../../workspaces/application/workspace-plan-limits.js';
import { PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN } from '../../agents/domain/example-user-phrases.js';
import {
  padPlannerAgentsForSchemaValidation,
  plannerOutputSchema,
  type TPlannerOutput,
} from './team-plan-planner-output.schema.js';
import { stripPlannerAgentsForImport, teamPlanImportEnvelopeSchema } from './team-plan-snapshot.schema.js';
import { resolveCatalogToolsForPlanAgent } from './planner-agent-catalog-tools.js';
import {
  assertSpecialistsExclusiveCatalogTools,
  formatCatalogToolConflictsForMessage,
  getSpecialistsCatalogToolConflicts,
  type ISpecialistCatalogToolConflict,
} from '../domain/planner-specialist-catalog-uniqueness.js';
import {
  assertSpecialistWorkflowOwnership,
  formatWorkflowConflictsForMessage,
  getSpecialistWorkflowConflicts,
  type IPlannerWorkflowConflict,
} from '../domain/planner-workflow-uniqueness.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' }).child({ module: 'team-plan' });

/** Limite de actionIds processados por execução (evita abuso / payloads enormes). */
const TEAM_PLAN_AUTO_BIND_MAX_ACTIONS = 64;

function materializePlannerAgentCatalogTools(plan: TPlannerOutput): TPlannerOutput['agents'] {
  let specialistOrdinal = 0;
  return plan.agents.map((agent) => {
    const specialistIndex = agent.role === 'specialist' ? specialistOrdinal++ : 0;
    const catalogTools = resolveCatalogToolsForPlanAgent(agent, { plan, specialistIndex });
    return { ...agent, catalogTools };
  });
}

/** Metadados persistidos em plannerMeta (API). */
export interface ITeamPlannerMeta {
  usedOpenAi: boolean;
  usedFallback: boolean;
  fallbackReason?: string;
  openaiResolvedFromEnv: boolean;
  /** Modelo OpenAI efectivamente usado na ultima geracao/reparo do planner. */
  plannerModel?: string;
  parseErrorSummary?: string;
  /** Loop 80: chamadas de reparo ao modelo apos colisao de catalogTools entre especialistas */
  catalogToolRepairAttempts?: number;
  /** Loop 80: plano final passou apos pelo menos uma rodada de reparo */
  catalogUniquenessRepaired?: boolean;
  /** Plano criado via importacao de snapshot (sem chamada ao planner). */
  importedSnapshot?: boolean;
}

export interface ITeamPlanBindPreviewDefinition {
  actionId: string;
  slug: string;
  packIds: string[];
  toolDefinitionId?: string;
  enabled?: boolean;
  currentStatus: 'missing' | 'existing_enabled' | 'existing_disabled';
  plannedOperation: 'create' | 'reuse' | 'reactivate' | 'none';
}

export interface ITeamPlanBindPreviewAgent {
  planAgentKey: string;
  agentName: string;
  role: 'coordinator' | 'specialist';
  planningMode: 'existing' | 'new' | 'split_required' | 'conflict';
  targetAgentId?: string;
  targetAgentName?: string;
  defaultBindMode: 'new_agent' | 'reused_merge' | 'reused_manual' | 'auto_bind_disabled';
  bindMode: 'new_agent' | 'reused_merge' | 'reused_manual' | 'auto_bind_disabled';
  overrideMode: 'inherit' | 'enabled' | 'disabled';
  effectiveBindEnabled: boolean;
  actionIdsCandidate: string[];
  defaultActionIdsToLink: string[];
  actionIdsToLink: string[];
  actionIdsAlreadyLinked: string[];
  actionIdsBlockedByDisabledDefinitions: string[];
  actionIdsExcludedByOverride: string[];
  actionIdsAddedByOverride: string[];
  actionIdsRemovedByOverride: string[];
}

export interface ITeamPlanBindPreviewPack {
  packId: string;
  actionIds: string[];
  defaultSelectedActionIds: string[];
  selectedActionIds: string[];
  actionIdsAddedByOverride: string[];
  actionIdsRemovedByOverride: string[];
}

export interface ITeamPlanBindDiffSummary {
  affectedAgentCount: number;
  addedActionCount: number;
  removedActionCount: number;
}

export interface ITeamPlanBindPreview {
  autoBindEnabled: boolean;
  autoBindMode: 'inherit' | 'enabled' | 'disabled';
  autoBindPolicySource: 'workspace_enabled' | 'workspace_disabled' | 'environment_default';
  reusedAgentBindMode: 'manual' | 'merge';
  effectiveBindEnabled: boolean;
  autoBindActionsRequested: number;
  autoBindActionsApplied: number;
  autoBindActionsTruncated: boolean;
  bindOverridesApplied: boolean;
  bindOverrideAgentCount: number;
  bindOverrideActionCount: number;
  requiresExplicitApproval: boolean;
  /** Loop 83 — candidatos por agente quando o plano tem listas por agente. */
  bindResolutionMode: 'global' | 'per_agent';
  toolDefinitions: ITeamPlanBindPreviewDefinition[];
  suggestedPacks: ITeamPlanBindPreviewPack[];
  diffSummary: ITeamPlanBindDiffSummary;
  agents: ITeamPlanBindPreviewAgent[];
}

export interface ITeamPlanBindOverrideEntry {
  mode: 'inherit' | 'enabled' | 'disabled';
  excludedActionIds: string[];
}

export interface ITeamPlanBindOverrides {
  agents: Record<string, ITeamPlanBindOverrideEntry>;
}

const bindOverrideEntrySchema = z.object({
  mode: z.enum(['inherit', 'enabled', 'disabled']).default('inherit'),
  excludedActionIds: z.array(z.string()).default([]),
});

const bindOverridesSchema = z
  .object({
    agents: z.record(z.string(), bindOverrideEntrySchema).default({}),
  })
  .default({ agents: {} });

function parseCustomToolDefinitionIds(capabilities: unknown): string[] {
  const rec = (capabilities as Record<string, unknown> | undefined) ?? {};
  return Array.isArray(rec['customToolDefinitionIds'])
    ? (rec['customToolDefinitionIds'] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
}

function normalizeActionIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function plannerAgentKeys(agents: TPlannerOutput['agents']): string[] {
  let specialistIndex = 1;
  return agents.map((agent) => {
    if (agent.role === 'coordinator') return 'coordinator';
    const key = `specialist-${specialistIndex}`;
    specialistIndex += 1;
    return key;
  });
}

function normalizeBindOverrides(
  raw: unknown,
  allowedAgentKeys: string[],
  allowedActionIds: string[],
): ITeamPlanBindOverrides {
  const parsed = bindOverridesSchema.parse(raw ?? { agents: {} });
  const allowedAgentKeySet = new Set(allowedAgentKeys);
  const allowedActionIdSet = new Set(allowedActionIds);
  const agents = Object.fromEntries(
    Object.entries(parsed.agents as Record<string, z.infer<typeof bindOverrideEntrySchema>>)
      .filter(([agentKey]) => allowedAgentKeySet.has(agentKey))
      .map(([agentKey, entry]) => {
        const excludedActionIds = normalizeActionIds(entry.excludedActionIds).filter((actionId) =>
          allowedActionIdSet.has(actionId),
        );
        return [agentKey, { mode: entry.mode, excludedActionIds }] satisfies [string, ITeamPlanBindOverrideEntry];
      })
      .filter(([, entry]) => entry.mode !== 'inherit' || entry.excludedActionIds.length > 0),
  );
  return { agents };
}

function buildPackIdsByActionId(requiredPacks: string[] | undefined, allowedActionIds: string[]): Map<string, string[]> {
  const allowed = new Set(allowedActionIds);
  const packIdsByActionId = new Map<string, string[]>();
  for (const rawPackId of requiredPacks ?? []) {
    const packId = rawPackId.trim().toLowerCase();
    const packActionIds = PLANNER_PACK_TO_ACTION_IDS[packId];
    if (!packActionIds) continue;
    for (const actionId of packActionIds) {
      if (!allowed.has(actionId)) continue;
      const current = packIdsByActionId.get(actionId) ?? [];
      if (!current.includes(packId)) current.push(packId);
      packIdsByActionId.set(actionId, current);
    }
  }
  return packIdsByActionId;
}

export class TeamPlanService {
  constructor(
    private readonly deps: IAppDeps,
    private readonly repo: TeamPlanRepository,
  ) {}

  private buildFallback(problem: string, context?: string, briefing?: ITeamPlannerStructuredBriefing): TPlannerOutput {
    const problemPreview = problem.slice(0, 80);
    const briefBusinessGoal = briefing?.businessGoal?.trim();
    const briefJourney = briefing?.coreJourney?.trim();
    const briefDomains = (briefing?.domainsNeeded ?? []).map((value) => value.trim()).filter(Boolean).join(', ');
    const briefHint = [briefBusinessGoal, briefJourney, briefDomains ? `Dominios: ${briefDomains}` : '']
      .filter(Boolean)
      .join(' | ');
    const objective = context?.trim()
      ? `${problem.trim()} Contexto: ${context.trim()}${briefHint ? ` Briefing: ${briefHint}` : ''}`
      : `${problem.trim()} Resolver com fluxo coordenado e previsivel.${briefHint ? ` Briefing: ${briefHint}` : ''}`;
    return {
      team: {
        name: `Time ${problemPreview}`.slice(0, 60),
        objective,
        description: `Plano gerado para: ${problemPreview}`,
        primaryChannel: 'api',
        channelIds: [],
        singleAgentMode: false,
      },
      agents: [
        {
          name: 'Whitebeard Coordenador',
          role: 'coordinator',
          description: 'Coordena especialistas, prioriza tarefas e consolida resposta.',
          objective: 'Garantir plano claro e execucao segura',
          responsibilities: ['Quebrar problema em etapas', 'Delegar aos especialistas', 'Consolidar entrega'],
          skills: ['planejamento', 'orquestracao', 'comunicacao'],
          category: 'planejamento',
          channels: ['api'],
          catalogTools: ['web_search'],
          workflowKey: 'coordination',
          requiredBusinessActionIds: [],
          requiredPackIds: [],
          exampleUserPhrases: [],
        },
        {
          name: 'Especialista de Dominio',
          role: 'specialist',
          description: 'Implementa a parte principal da solucao.',
          objective: 'Produzir a solucao tecnica para o problema',
          responsibilities: ['Analisar requisitos', 'Executar a tarefa especializada'],
          skills: ['analise', 'execucao'],
          category: 'execucao',
          channels: [],
          catalogTools: ['web_search', 'file_search'],
          workflowKey: 'execucao',
          requiredBusinessActionIds: [],
          requiredPackIds: [],
          exampleUserPhrases: [
            'Preciso de ajuda com o problema descrito acima',
            'Executa a analise principal e devolve o resultado',
          ],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [
        'Validar integracao OpenAI do workspace',
        'Confirmar coordenador e especialistas',
        'Revisar canais e objetivo',
      ],
      requiredPacks: [],
      requiredTools: [],
    };
  }

  /** Dados do nó React Flow alinhados ao agente do plano (preview / execute mapeia agentId → Mongo). */
  private static agentGraphData(
    agent: TPlannerOutput['agents'][number],
    agentIdKey: string,
  ): Record<string, unknown> {
    return {
      label: agent.name,
      agentId: agentIdKey,
      category: agent.category ?? 'geral',
      description: agent.description ?? '',
      objective: agent.objective ?? '',
      skills: agent.skills ?? [],
      responsibilities: agent.responsibilities ?? [],
      workflowKey: agent.workflowKey ?? '',
    };
  }

  /**
   * Layout determinístico do spine coordenador → especialistas.
   * Ignora `plan.graph` da LLM (posições podem sobrepor); só usamos os agentes.
   */
  private buildDefaultGraph(plan: TPlannerOutput) {
    const SPACING = 280;
    const CENTER_X = 320;
    const COORD_Y = 80;
    const SPEC_Y = 260;

    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<Record<string, unknown>> = [];
    const coord = plan.agents.find((a) => a.role === 'coordinator') ?? plan.agents[0];
    const coordNodeId = 'coordinator-0';
    nodes.push({
      id: coordNodeId,
      type: 'coordinator',
      data: TeamPlanService.agentGraphData(coord, 'coordinator'),
      position: { x: CENTER_X, y: COORD_Y },
    });

    const specialists = plan.agents.filter((a) => a.role === 'specialist');
    const n = specialists.length;
    specialists.forEach((agent, i) => {
      const idx = i + 1;
      const nid = `specialist-${idx}`;
      const xOffset = n > 0 ? (i - (n - 1) / 2) * SPACING : 0;
      nodes.push({
        id: nid,
        type: 'specialist',
        data: TeamPlanService.agentGraphData(agent, `specialist-${idx}`),
        position: { x: CENTER_X + xOffset, y: SPEC_Y },
      });
      edges.push({ id: `e-${coordNodeId}-${nid}`, source: coordNodeId, target: nid, type: 'smoothstep' });
    });
    return { nodes, edges };
  }

  private async annotateAgentsWithReuse(workspaceId: string, agents: TPlannerOutput['agents']) {
    const annotated: TPlannerOutput['agents'] = [];
    const reuseRecommendations: string[] = [];
    const conflicts: Array<{ agentName: string; existingAgentId?: string; reason: string }> = [];

    for (const agent of agents) {
      const review = await this.deps.domainGuardService.review(workspaceId, {
        name: agent.name,
        description: agent.description,
        role: agent.role,
        category: agent.category,
        skills: agent.skills,
        goal: agent.objective,
        responsibilities: agent.responsibilities,
        domain: {
          summary: agent.objective,
          keywords: agent.skills,
          inputDescription: agent.description,
          outputDescription: agent.objective,
          boundaries: agent.responsibilities,
          exclusions: [],
        },
      } satisfies IAgentGovernanceDraft);
      const top = review.matches[0];
      const planningMode: 'existing' | 'new' | 'split_required' | 'conflict' =
        review.decision === 'reuse_existing'
          ? 'existing'
          : review.decision === 'block'
            ? 'conflict'
            : review.decision === 'review'
              ? 'split_required'
              : 'new';
      if (planningMode === 'existing' && top) {
        reuseRecommendations.push(`Reutilizar "${top.agentName}" para o papel planejado de "${agent.name}".`);
      }
      if (planningMode === 'conflict') {
        conflicts.push({
          agentName: agent.name,
          existingAgentId: top?.agentId,
          reason: review.summary,
        });
      }
      annotated.push({
        ...agent,
        planningMode,
        existingAgentId: top?.agentId ?? null,
        overlapScore: top?.score ?? 0,
        overlapReason: top?.reason ?? review.summary,
      });
    }

    return {
      agents: annotated,
      reuseSummary: {
        reuseRecommendations,
        conflicts,
        existingAgentRefs: annotated.filter((agent) => agent.planningMode === 'existing').map((agent) => agent.existingAgentId),
        proposedNewAgents: annotated.filter((agent) => agent.planningMode !== 'existing').map((agent) => agent.name),
      },
    };
  }

  /** Loop 80: max chamadas de reparo OpenAI apos colisao (env `TEAM_PLAN_CATALOG_REPAIR_MAX_ATTEMPTS`; default 3). */
  private teamPlanCatalogRepairMaxAttempts(): number {
    const raw = process.env.TEAM_PLAN_CATALOG_REPAIR_MAX_ATTEMPTS?.trim();
    if (raw === undefined || raw === '') return 3;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 3;
    return Math.max(0, Math.min(n, 8));
  }

  private async evaluateMaterializedPlannerStructure(
    workspaceId: string,
    raw: TPlannerOutput,
  ): Promise<{
    reuse: Awaited<ReturnType<TeamPlanService['annotateAgentsWithReuse']>>;
    parsedForGraph: TPlannerOutput;
    agentsMaterialized: TPlannerOutput['agents'];
    catalogConflicts: ISpecialistCatalogToolConflict[];
    workflowConflicts: IPlannerWorkflowConflict[];
  }> {
    const reuse = await this.annotateAgentsWithReuse(workspaceId, raw.agents);
    const parsedForGraph = plannerOutputSchema.parse({
      team: raw.team,
      agents: padPlannerAgentsForSchemaValidation(reuse.agents),
      graph: raw.graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
    });
    const agentsMaterialized = materializePlannerAgentCatalogTools(parsedForGraph);
    const catalogConflicts = getSpecialistsCatalogToolConflicts(agentsMaterialized);
    const workflowConflicts = getSpecialistWorkflowConflicts(parsedForGraph.agents);
    return { reuse, parsedForGraph, agentsMaterialized, catalogConflicts, workflowConflicts };
  }

  private formatPlanPayloadForRepair(ev: {
    parsedForGraph: TPlannerOutput;
    agentsMaterialized: TPlannerOutput['agents'];
  }): string {
    const payload = {
      team: ev.parsedForGraph.team,
      agents: ev.parsedForGraph.agents.map((agent, i) => ({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        objective: agent.objective,
        responsibilities: agent.responsibilities,
        skills: agent.skills,
        category: agent.category,
        channels: agent.channels,
        catalogTools: ev.agentsMaterialized[i]?.catalogTools ?? [],
        workflowKey: agent.workflowKey,
        requiredBusinessActionIds: agent.requiredBusinessActionIds,
        requiredPackIds: agent.requiredPackIds,
        exampleUserPhrases: agent.exampleUserPhrases,
      })),
      graph: { nodes: [] as unknown[], edges: [] as unknown[] },
      executionChecklist: ev.parsedForGraph.executionChecklist,
      requiredPacks: ev.parsedForGraph.requiredPacks,
      requiredTools: ev.parsedForGraph.requiredTools,
    };
    return JSON.stringify(payload, null, 2);
  }

  private async fetchRepairedPlannerOutput(params: {
    workspaceId: string;
    apiKey: string;
    problem: string;
    context?: string;
    invalidPlanJson: string;
    diagnosis: string;
    repairAttempt: number;
  }): Promise<TPlannerOutput | null> {
    const model = await this.deps.workspaceIntegrationsService.resolveTeamPlannerModel(params.workspaceId);
    const { content } = await fetchTeamPlanJsonCompletion({
      apiKey: params.apiKey,
      model,
      systemPrompt: TEAM_PLANNER_REPAIR_SYSTEM_PROMPT,
      userMessage: buildTeamPlannerRepairUserMessage({
        problem: params.problem,
        context: params.context,
        invalidPlanJson: params.invalidPlanJson,
        diagnosis: params.diagnosis,
        repairAttempt: params.repairAttempt,
      }),
    });
    const extracted = this.extractJsonLoose(content);
    if (extracted === null) return null;
    const body = extracted as Record<string, unknown>;
    const patched = {
      ...body,
      agents: padPlannerAgentsForSchemaValidation(body['agents']),
    };
    const parsed = plannerOutputSchema.safeParse(patched);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Loop 80 — ate N chamadas de reparo quando dois especialistas partilham o mesmo builtin de dominio
   * apos materializar catalogTools (inferencia incluida).
   */
  private async resolveCatalogUniquenessWithRepair(params: {
    workspaceId: string;
    problem: string;
    context?: string;
    briefing?: ITeamPlannerStructuredBriefing;
    initialRaw: TPlannerOutput;
    apiKey: string;
  }): Promise<{
    raw: TPlannerOutput;
    plannerMetaExtras: Partial<ITeamPlannerMeta>;
  }> {
    const maxRepairs = this.teamPlanCatalogRepairMaxAttempts();
    let current = params.initialRaw;
    let repairsUsed = 0;

    while (true) {
      const ev = await this.evaluateMaterializedPlannerStructure(params.workspaceId, current);
      if (ev.catalogConflicts.length === 0 && ev.workflowConflicts.length === 0) {
        return {
          raw: current,
          plannerMetaExtras: {
            catalogToolRepairAttempts: repairsUsed,
            catalogUniquenessRepaired: repairsUsed > 0,
          },
        };
      }

      if (repairsUsed >= maxRepairs) {
        return {
          raw: this.buildFallback(params.problem, params.context, params.briefing),
          plannerMetaExtras: {
            catalogToolRepairAttempts: repairsUsed,
            catalogUniquenessRepaired: false,
            usedOpenAi: false,
            usedFallback: true,
            fallbackReason: 'catalog_uniqueness_exhausted_repair',
          },
        };
      }

      const diagnosisParts: string[] = [];
      if (ev.catalogConflicts.length > 0) {
        diagnosisParts.push(`catalogTools de dominio repetidos: ${formatCatalogToolConflictsForMessage(ev.catalogConflicts)}`);
      }
      if (ev.workflowConflicts.length > 0) {
        diagnosisParts.push(`workflowKey duplicado entre especialistas: ${formatWorkflowConflictsForMessage(ev.workflowConflicts)}`);
      }
      const diagnosis = diagnosisParts.join(' | ');
      const invalidPlanJson = this.formatPlanPayloadForRepair(ev);
      const repaired = await this.fetchRepairedPlannerOutput({
        workspaceId: params.workspaceId,
        apiKey: params.apiKey,
        problem: params.problem,
        context: params.context,
        invalidPlanJson,
        diagnosis,
        repairAttempt: repairsUsed + 1,
      });
      repairsUsed++;
      if (!repaired) {
        return {
          raw: this.buildFallback(params.problem, params.context, params.briefing),
          plannerMetaExtras: {
            catalogToolRepairAttempts: repairsUsed,
            catalogUniquenessRepaired: false,
            usedOpenAi: false,
            usedFallback: true,
            fallbackReason: 'catalog_repair_parse_failed',
          },
        };
      }
      current = repaired;
    }
  }

  /** Extrai JSON do texto (markdown ou puro); null se nao houver objeto parseavel. */
  private extractJsonLoose(text: string): unknown | null {
    const content = text.trim();
    try {
      return JSON.parse(content);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(content.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  async createPlan(workspaceId: string, input: { problem: string; context?: string; briefing?: ITeamPlannerStructuredBriefing }) {
    const briefingSufficiency = evaluateTeamPlanBriefingSufficiency(input.briefing);
    const integrityModel = buildTeamPlanIntegrityModel(input.briefing);
    if (input.briefing && briefingSufficiency.status === 'insufficient') {
      throw new AppError(
        'BRIEFING_INSUFFICIENT',
        'Briefing insuficiente para gerar plano. Complete os campos essenciais e tente novamente.',
        422,
        {
          sufficiency: briefingSufficiency,
          hint: 'Responda objetivo de negócio, jornada principal, entidades e tipo de operação.',
        },
      );
    }

    const keyResolution = await this.deps.workspaceIntegrationsService.resolveOpenAiApiKeyWithSource(workspaceId);
    const apiKey = keyResolution.apiKey;
    const openaiResolvedFromEnv = keyResolution.source === 'environment';

    let raw: TPlannerOutput;
    let plannerMeta: ITeamPlannerMeta;

    if (!apiKey) {
      raw = this.buildFallback(input.problem, input.context, input.briefing);
      plannerMeta = {
        usedOpenAi: false,
        usedFallback: true,
        fallbackReason: 'no_openai_key',
        openaiResolvedFromEnv: false,
      };
    } else {
      try {
        const plannerModelResolved =
          await this.deps.workspaceIntegrationsService.resolveTeamPlannerModel(workspaceId);
        const { content } = await fetchTeamPlanJsonCompletion({
          apiKey,
          model: plannerModelResolved,
          systemPrompt: TEAM_PLANNER_SYSTEM_PROMPT,
          userMessage: buildTeamPlannerUserMessage(input.problem, input.context, input.briefing),
        });
        const extracted = this.extractJsonLoose(content);
        if (extracted === null) {
          log.warn({ workspaceId }, 'team plan: JSON nao extraido da resposta OpenAI');
          raw = this.buildFallback(input.problem, input.context, input.briefing);
          plannerMeta = {
            usedOpenAi: false,
            usedFallback: true,
            fallbackReason: 'json_extract_failed',
            openaiResolvedFromEnv,
            plannerModel: plannerModelResolved,
          };
        } else {
          const ext = extracted as Record<string, unknown>;
          const extractedPadded = {
            ...ext,
            agents: padPlannerAgentsForSchemaValidation(ext['agents']),
          };
          const parsed = plannerOutputSchema.safeParse(extractedPadded);
          if (parsed.success) {
            raw = parsed.data;
            plannerMeta = {
              usedOpenAi: true,
              usedFallback: false,
              openaiResolvedFromEnv,
              plannerModel: plannerModelResolved,
            };
          } else {
            const parseSummary = parsed.error.message.slice(0, 400);
            log.warn({ workspaceId, zod: parseSummary }, 'team plan: JSON nao passou na validacao');
            raw = this.buildFallback(input.problem, input.context, input.briefing);
            plannerMeta = {
              usedOpenAi: false,
              usedFallback: true,
              fallbackReason: 'schema_validation_failed',
              openaiResolvedFromEnv,
              parseErrorSummary: parseSummary,
              plannerModel: plannerModelResolved,
            };
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ workspaceId, err: msg }, 'team plan: falha na chamada OpenAI');
        raw = this.buildFallback(input.problem, input.context, input.briefing);
        const plannerModelResolved =
          await this.deps.workspaceIntegrationsService.resolveTeamPlannerModel(workspaceId);
        plannerMeta = {
          usedOpenAi: false,
          usedFallback: true,
          fallbackReason: 'openai_request_failed',
          openaiResolvedFromEnv,
          parseErrorSummary: msg.slice(0, 400),
          plannerModel: plannerModelResolved,
        };
      }
    }

    if (apiKey && plannerMeta.usedOpenAi && !plannerMeta.usedFallback) {
      const resolved = await this.resolveCatalogUniquenessWithRepair({
        workspaceId,
        problem: input.problem,
        context: input.context,
        briefing: input.briefing,
        initialRaw: raw,
        apiKey,
      });
      raw = resolved.raw;
      plannerMeta = {
        ...plannerMeta,
        ...resolved.plannerMetaExtras,
      };
    }

    if (apiKey && !plannerMeta.plannerModel) {
      plannerMeta = {
        ...plannerMeta,
        plannerModel: await this.deps.workspaceIntegrationsService.resolveTeamPlannerModel(workspaceId),
      };
    }

    const reuse = await this.annotateAgentsWithReuse(workspaceId, raw.agents);
    const parsedForGraph = plannerOutputSchema.parse({
      team: raw.team,
      agents: padPlannerAgentsForSchemaValidation(reuse.agents),
      graph: raw.graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
    });
    const agentsMaterialized = materializePlannerAgentCatalogTools(parsedForGraph);
    assertSpecialistWorkflowOwnership(parsedForGraph.agents);
    assertSpecialistsExclusiveCatalogTools(agentsMaterialized);
    const graph = this.buildDefaultGraph({ ...parsedForGraph, agents: agentsMaterialized });
    const created = await this.repo.create(workspaceId, {
      problem: input.problem,
      context: input.context,
      briefing: input.briefing,
      status: 'ready',
      team: raw.team,
      agents: agentsMaterialized.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
      plannerMeta: {
        ...(plannerMeta as unknown as Record<string, unknown>),
        platformAssistant: 'team-crafter',
        briefingSufficiency,
        integrityModel,
      },
      reuseSummary: reuse.reuseSummary,
    });
    return created;
  }

  async importPlanFromSnapshot(workspaceId: string, rawBody: unknown) {
    const envelopeParse = teamPlanImportEnvelopeSchema.safeParse(rawBody);
    if (!envelopeParse.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'JSON de importacao invalido. Use o formato exportado pelo AI Builder (schemaVersion 1).',
        422,
        { issues: envelopeParse.error.issues.slice(0, 24) },
      );
    }
    const { plan } = envelopeParse.data;
    const teamName =
      plan.team &&
      typeof plan.team === 'object' &&
      plan.team !== null &&
      'name' in plan.team &&
      typeof (plan.team as { name?: unknown }).name === 'string'
        ? String((plan.team as { name: string }).name).trim() || 'Time importado'
        : 'Time importado';
    const problemBase = plan.problem.trim();
    const problem =
      problemBase.length >= 10 ? problemBase : `Plano importado — ${teamName}`.slice(0, 400);
    const briefing = plan.briefing as ITeamPlannerStructuredBriefing | undefined;
    const briefingSufficiency = evaluateTeamPlanBriefingSufficiency(briefing);
    const integrityModel = buildTeamPlanIntegrityModel(briefing);
    const strippedAgents = stripPlannerAgentsForImport(plan.agents);
    const raw: TPlannerOutput = {
      team: plan.team as TPlannerOutput['team'],
      agents: strippedAgents as TPlannerOutput['agents'],
      graph: plan.graph ?? { nodes: [], edges: [] },
      executionChecklist: plan.executionChecklist,
      requiredPacks: plan.requiredPacks,
      requiredTools: plan.requiredTools,
    };
    const reuse = await this.annotateAgentsWithReuse(workspaceId, raw.agents);
    const parsedForGraph = plannerOutputSchema.parse({
      team: raw.team,
      agents: padPlannerAgentsForSchemaValidation(reuse.agents),
      graph: raw.graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
    });
    const agentsMaterialized = materializePlannerAgentCatalogTools(parsedForGraph);
    assertSpecialistWorkflowOwnership(parsedForGraph.agents);
    assertSpecialistsExclusiveCatalogTools(agentsMaterialized);
    const graph = this.buildDefaultGraph({ ...parsedForGraph, agents: agentsMaterialized });
    const bindUniverse = computePlannerBindActionUniverse(
      agentsMaterialized.map((a) => ({
        role: a.role,
        requiredBusinessActionIds: a.requiredBusinessActionIds,
        requiredPackIds: a.requiredPackIds,
      })),
      parsedForGraph.requiredTools,
      parsedForGraph.requiredPacks,
      TEAM_PLAN_AUTO_BIND_MAX_ACTIONS,
    );
    const normalizedBindOverrides = normalizeBindOverrides(
      plan.bindOverrides,
      plannerAgentKeys(parsedForGraph.agents),
      bindUniverse.actionIds,
    );
    const created = await this.repo.create(workspaceId, {
      problem,
      context: plan.context,
      briefing: briefing ?? null,
      status: 'ready',
      team: parsedForGraph.team,
      agents: agentsMaterialized.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
      bindOverrides: normalizedBindOverrides as unknown as Record<string, unknown>,
      plannerMeta: {
        usedOpenAi: false,
        usedFallback: false,
        openaiResolvedFromEnv: false,
        importedSnapshot: true,
        briefingSufficiency,
        integrityModel,
      },
      reuseSummary: reuse.reuseSummary,
    });
    return created;
  }

  async updatePlan(
    workspaceId: string,
    id: string,
    patch: { team?: unknown; agents?: unknown; graph?: unknown; bindOverrides?: unknown },
  ) {
    const current = await this.repo.findById(workspaceId, id);
    if (!current) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (current.status === 'executing' || current.status === 'executed') {
      throw new AppError('CONFLICT', 'Plano ja foi executado ou esta em execucao', 409);
    }
    const next = {
      team: patch.team ?? current.team,
      agents: patch.agents ?? current.agents,
      graph: patch.graph ?? current.graph,
    };
    const parsed = plannerOutputSchema.parse({
      team: next.team,
      agents: padPlannerAgentsForSchemaValidation(next.agents),
      graph: next.graph,
      executionChecklist: current.executionChecklist ?? [],
      requiredPacks: current.requiredPacks ?? [],
      requiredTools: current.requiredTools ?? [],
    });
    const bindUniverse = computePlannerBindActionUniverse(
      parsed.agents.map((a) => ({
        role: a.role,
        requiredBusinessActionIds: a.requiredBusinessActionIds,
        requiredPackIds: a.requiredPackIds,
      })),
      parsed.requiredTools,
      parsed.requiredPacks,
      TEAM_PLAN_AUTO_BIND_MAX_ACTIONS,
    );
    const normalizedBindOverrides = normalizeBindOverrides(
      patch.bindOverrides ?? current.bindOverrides,
      plannerAgentKeys(parsed.agents),
      bindUniverse.actionIds,
    );
    const reuse = await this.annotateAgentsWithReuse(workspaceId, parsed.agents);
    const fullPlan = plannerOutputSchema.parse({
      team: parsed.team,
      agents: padPlannerAgentsForSchemaValidation(reuse.agents),
      graph: parsed.graph,
      executionChecklist: parsed.executionChecklist,
      requiredPacks: parsed.requiredPacks,
      requiredTools: parsed.requiredTools,
    });
    const agentsMaterialized = materializePlannerAgentCatalogTools(fullPlan);
    assertSpecialistWorkflowOwnership(fullPlan.agents);
    assertSpecialistsExclusiveCatalogTools(agentsMaterialized);
    const updated = await this.repo.update(workspaceId, id, {
      team: parsed.team,
      agents: agentsMaterialized.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph: parsed.graph,
      bindOverrides: normalizedBindOverrides as unknown as Record<string, unknown>,
      status: 'ready',
      reuseSummary: reuse.reuseSummary,
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    return updated;
  }

  async updateBindOverrides(
    workspaceId: string,
    id: string,
    rawBindOverrides: unknown,
  ): Promise<{
    plan: NonNullable<Awaited<ReturnType<TeamPlanRepository['findById']>>>;
    preview: ITeamPlanBindPreview;
  }> {
    const current = await this.repo.findById(workspaceId, id);
    if (!current) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (current.status === 'executing' || current.status === 'executed') {
      throw new AppError('CONFLICT', 'Plano ja foi executado ou esta em execucao', 409);
    }
    const parsed = plannerOutputSchema.parse({
      team: current.team,
      agents: padPlannerAgentsForSchemaValidation(current.agents),
      graph: current.graph,
      executionChecklist: current.executionChecklist ?? [],
      requiredPacks: current.requiredPacks ?? [],
      requiredTools: current.requiredTools ?? [],
    });
    const bindUniverse = computePlannerBindActionUniverse(
      parsed.agents.map((a) => ({
        role: a.role,
        requiredBusinessActionIds: a.requiredBusinessActionIds,
        requiredPackIds: a.requiredPackIds,
      })),
      parsed.requiredTools,
      parsed.requiredPacks,
      TEAM_PLAN_AUTO_BIND_MAX_ACTIONS,
    );
    const normalizedBindOverrides = normalizeBindOverrides(
      rawBindOverrides,
      plannerAgentKeys(parsed.agents),
      bindUniverse.actionIds,
    );
    const updated = await this.repo.update(workspaceId, id, {
      bindOverrides: normalizedBindOverrides as unknown as Record<string, unknown>,
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    const workspaceRecord = await this.deps.workspaceRepo.findById(workspaceId);
    const envDefaultEnabled = (this.deps.env.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0') === '1';
    const autoBindPolicy = resolveTeamPlanAutoBindPolicy(
      (workspaceRecord?.settings as Record<string, unknown> | undefined) ?? {},
      envDefaultEnabled,
    );
    const { preview } = await this.buildBindPreview(workspaceId, parsed, autoBindPolicy, normalizedBindOverrides);
    return { plan: updated, preview };
  }

  private async buildBindPreview(
    workspaceId: string,
    parsed: TPlannerOutput,
    autoBindPolicy: ReturnType<typeof resolveTeamPlanAutoBindPolicy>,
    rawBindOverrides: unknown = { agents: {} },
  ): Promise<{
    actionIdsFull: string[];
    actionIds: string[];
    actionIdsTruncated: boolean;
    selectedActionIds: string[];
    bindOverrides: ITeamPlanBindOverrides;
    preview: ITeamPlanBindPreview;
  }> {
    const bindUniverse = computePlannerBindActionUniverse(
      parsed.agents.map((a) => ({
        role: a.role,
        requiredBusinessActionIds: a.requiredBusinessActionIds,
        requiredPackIds: a.requiredPackIds,
      })),
      parsed.requiredTools,
      parsed.requiredPacks,
      TEAM_PLAN_AUTO_BIND_MAX_ACTIONS,
    );
    const { actionIdsFull, actionIds, actionIdsTruncated, perAgentActionIds, usePerAgentMode } = bindUniverse;
    const bindResolutionMode = usePerAgentMode ? ('per_agent' as const) : ('global' as const);
    const bindOverrides = normalizeBindOverrides(rawBindOverrides, plannerAgentKeys(parsed.agents), actionIds);
    const packIdsMerged = mergePlannerPackIdsForBind(parsed.agents, parsed.requiredPacks);
    const packIdsByActionId = buildPackIdsByActionId(packIdsMerged, actionIds);
    const allToolDefinitions = await this.deps.workspaceToolDefinitionRepo.list(workspaceId);

    const internalActionByActionId = new Map<string, (typeof allToolDefinitions)[number]>();
    const internalActionBySlug = new Map<string, (typeof allToolDefinitions)[number]>();

    for (const definition of allToolDefinitions) {
      if (definition.kind !== 'internal_action') continue;
      internalActionBySlug.set(definition.slug, definition);
      const actionId =
        typeof ((definition.config as Record<string, unknown> | undefined) ?? {})['actionId'] === 'string'
          ? String((definition.config as Record<string, unknown>)['actionId'])
          : undefined;
      if (actionId && !internalActionByActionId.has(actionId)) internalActionByActionId.set(actionId, definition);
    }

    const definitionPreviewByActionId = new Map(
      actionIds.map((actionId) => {
        const existing = internalActionByActionId.get(actionId) ?? internalActionBySlug.get(actionIdToToolSlug(actionId));
        const definition: ITeamPlanBindPreviewDefinition = {
          actionId,
          slug: actionIdToToolSlug(actionId),
          packIds: packIdsByActionId.get(actionId) ?? [],
          toolDefinitionId: existing?.id,
          enabled: existing?.enabled,
          currentStatus: !existing ? 'missing' : existing.enabled ? 'existing_enabled' : 'existing_disabled',
          plannedOperation: 'none',
        };
        return [
          actionId,
          definition,
        ];
      }),
    );
    const existingAgentIds = [...new Set(
      parsed.agents
        .filter((agent) => agent.planningMode === 'existing' && agent.existingAgentId)
        .map((agent) => String(agent.existingAgentId)),
    )];
    const existingAgents = await Promise.all(existingAgentIds.map((agentId) => this.deps.agentRepo.findById(workspaceId, agentId)));
    const existingAgentsById = new Map(existingAgentIds.map((agentId, index) => [agentId, existingAgents[index] ?? null]));
    const agentKeys = plannerAgentKeys(parsed.agents);

    const agents: ITeamPlanBindPreviewAgent[] = parsed.agents.map((agent, index) => {
      const planAgentKey = agentKeys[index] ?? `agent-${index + 1}`;
      const agentActionIds = perAgentActionIds[index] ?? [];
      const isExisting = agent.planningMode === 'existing' && Boolean(agent.existingAgentId);
      const targetAgent = isExisting && agent.existingAgentId ? existingAgentsById.get(String(agent.existingAgentId)) : null;
      const alreadyLinkedIds = parseCustomToolDefinitionIds(targetAgent?.capabilities);
      const actionIdsAlreadyLinked = agentActionIds.filter((actionId) => {
        const definition = definitionPreviewByActionId.get(actionId);
        return Boolean(definition?.toolDefinitionId && alreadyLinkedIds.includes(String(definition.toolDefinitionId)));
      });
      const actionIdsBlockedByDisabledDefinitions = agentActionIds.filter(
        (actionId) => definitionPreviewByActionId.get(actionId)?.currentStatus === 'existing_disabled',
      );
      const defaultBindMode: ITeamPlanBindPreviewAgent['defaultBindMode'] = autoBindPolicy.autoBindEnabled
        ? isExisting
          ? autoBindPolicy.reusedAgentBindMode === 'merge'
            ? 'reused_merge'
            : 'reused_manual'
          : 'new_agent'
        : 'auto_bind_disabled';
      const defaultBindEnabled = defaultBindMode === 'new_agent' || defaultBindMode === 'reused_merge';
      const agentOverride = bindOverrides.agents[planAgentKey] ?? { mode: 'inherit', excludedActionIds: [] };
      const effectiveBindEnabled =
        agentOverride.mode === 'inherit' ? defaultBindEnabled : agentOverride.mode === 'enabled';
      const actionIdsCandidate = agentActionIds.filter((actionId) => !actionIdsAlreadyLinked.includes(actionId));
      const defaultActionIdsToLink = defaultBindEnabled ? [...actionIdsCandidate] : [];
      const actionIdsExcludedByOverride = actionIdsCandidate.filter((actionId) =>
        agentOverride.excludedActionIds.includes(actionId),
      );
      const actionIdsToLink = effectiveBindEnabled
        ? actionIdsCandidate.filter((actionId) => !actionIdsExcludedByOverride.includes(actionId))
        : [];
      const bindMode: ITeamPlanBindPreviewAgent['bindMode'] = effectiveBindEnabled
        ? isExisting
          ? 'reused_merge'
          : 'new_agent'
        : 'auto_bind_disabled';
      const actionIdsAddedByOverride = actionIdsToLink.filter((actionId) => !defaultActionIdsToLink.includes(actionId));
      const actionIdsRemovedByOverride = defaultActionIdsToLink.filter((actionId) => !actionIdsToLink.includes(actionId));

      return {
        planAgentKey,
        agentName: agent.name,
        role: agent.role,
        planningMode: agent.planningMode ?? 'new',
        targetAgentId: isExisting ? String(agent.existingAgentId) : undefined,
        targetAgentName: isExisting ? String(targetAgent?.name ?? agent.name) : undefined,
        defaultBindMode,
        bindMode,
        overrideMode: agentOverride.mode,
        effectiveBindEnabled,
        actionIdsCandidate,
        defaultActionIdsToLink,
        actionIdsToLink,
        actionIdsAlreadyLinked,
        actionIdsBlockedByDisabledDefinitions,
        actionIdsExcludedByOverride,
        actionIdsAddedByOverride,
        actionIdsRemovedByOverride,
      };
    });
    const selectedActionIds = [...new Set(agents.flatMap((agent) => agent.actionIdsToLink))];
    for (const actionId of selectedActionIds) {
      const definition = definitionPreviewByActionId.get(actionId);
      if (!definition) continue;
      if (!definition.toolDefinitionId) {
        definition.plannedOperation = 'create';
      } else if (definition.currentStatus === 'existing_disabled') {
        definition.plannedOperation = 'reactivate';
      } else {
        definition.plannedOperation = 'reuse';
      }
    }
    const toolDefinitions = actionIds.map((actionId) => definitionPreviewByActionId.get(actionId)!);
    const needsCreateOrReactivate = toolDefinitions.some(
      (d) => d.plannedOperation === 'create' || d.plannedOperation === 'reactivate',
    );
    const bindOverrideAgentCount = agents.filter((agent) => agent.overrideMode !== 'inherit').length;
    const bindOverrideActionCount = agents.reduce(
      (count, agent) => count + agent.actionIdsExcludedByOverride.length,
      0,
    );
    const bindOverridesApplied = bindOverrideAgentCount > 0 || bindOverrideActionCount > 0;
    const diffSummary: ITeamPlanBindDiffSummary = {
      affectedAgentCount: agents.filter(
        (agent) => agent.actionIdsAddedByOverride.length > 0 || agent.actionIdsRemovedByOverride.length > 0,
      ).length,
      addedActionCount: agents.reduce((count, agent) => count + agent.actionIdsAddedByOverride.length, 0),
      removedActionCount: agents.reduce((count, agent) => count + agent.actionIdsRemovedByOverride.length, 0),
    };
    const suggestedPackIds = [...new Set(
      packIdsMerged.filter((packId) => Boolean(PLANNER_PACK_TO_ACTION_IDS[packId])),
    )];
    const suggestedPacks: ITeamPlanBindPreviewPack[] = suggestedPackIds
      .map((packId) => {
        const packActionIds = actionIds.filter((actionId) => (packIdsByActionId.get(actionId) ?? []).includes(packId));
        const defaultSelectedActionIds = [...new Set(
          agents.flatMap((agent) => agent.defaultActionIdsToLink.filter((actionId) => packActionIds.includes(actionId))),
        )];
        const selectedActionIdsForPack = [...new Set(
          agents.flatMap((agent) => agent.actionIdsToLink.filter((actionId) => packActionIds.includes(actionId))),
        )];
        const actionIdsAddedByOverride = [...new Set(
          agents.flatMap((agent) => agent.actionIdsAddedByOverride.filter((actionId) => packActionIds.includes(actionId))),
        )];
        const actionIdsRemovedByOverride = [...new Set(
          agents.flatMap((agent) => agent.actionIdsRemovedByOverride.filter((actionId) => packActionIds.includes(actionId))),
        )];
        return {
          packId,
          actionIds: packActionIds,
          defaultSelectedActionIds,
          selectedActionIds: selectedActionIdsForPack,
          actionIdsAddedByOverride,
          actionIdsRemovedByOverride,
        };
      })
      .filter((pack) => pack.actionIds.length > 0);

    return {
      actionIdsFull,
      actionIds,
      actionIdsTruncated,
      selectedActionIds,
      bindOverrides,
      preview: {
        autoBindEnabled: autoBindPolicy.autoBindEnabled,
        autoBindMode: autoBindPolicy.autoBindMode,
        autoBindPolicySource: autoBindPolicy.source,
        reusedAgentBindMode: autoBindPolicy.reusedAgentBindMode,
        effectiveBindEnabled: agents.some((agent) => agent.effectiveBindEnabled),
        autoBindActionsRequested: actionIdsFull.length,
        autoBindActionsApplied: selectedActionIds.length,
        autoBindActionsTruncated: actionIdsTruncated,
        bindOverridesApplied,
        bindOverrideAgentCount,
        bindOverrideActionCount,
        requiresExplicitApproval:
          selectedActionIds.length > 0 || needsCreateOrReactivate || bindOverridesApplied,
        bindResolutionMode,
        toolDefinitions,
        suggestedPacks,
        diffSummary,
        agents,
      },
    };
  }

  async previewBind(workspaceId: string, id: string): Promise<ITeamPlanBindPreview> {
    const workspaceRecord = await this.deps.workspaceRepo.findById(workspaceId);
    const envDefaultEnabled = (this.deps.env.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0') === '1';
    const autoBindPolicy = resolveTeamPlanAutoBindPolicy(
      (workspaceRecord?.settings as Record<string, unknown> | undefined) ?? {},
      envDefaultEnabled,
    );
    const plan = await this.repo.findById(workspaceId, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    const parsed = plannerOutputSchema.parse({
      team: plan.team,
      agents: padPlannerAgentsForSchemaValidation(plan.agents),
      graph: plan.graph,
      executionChecklist: plan.executionChecklist ?? [],
      requiredPacks: plan.requiredPacks ?? [],
      requiredTools: plan.requiredTools ?? [],
    });
    const { preview } = await this.buildBindPreview(workspaceId, parsed, autoBindPolicy, plan.bindOverrides);
    return preview;
  }

  /**
   * Ativa `WorkspaceToolDefinition` inativas referenciadas pelo preview de bind do plano,
   * sem exigir ir à página de tool-definitions (Loop 51).
   */
  async enableDisabledBindDefinitions(
    workspaceId: string,
    planId: string,
    actionIds: string[],
  ): Promise<{ preview: ITeamPlanBindPreview; reactivatedToolDefinitionIds: string[] }> {
    const plan = await this.repo.findById(workspaceId, planId);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (plan.status === 'executing' || plan.status === 'executed') {
      throw new AppError('CONFLICT', 'Plano ja foi executado ou esta em execucao', 409);
    }
    const workspaceRecord = await this.deps.workspaceRepo.findById(workspaceId);
    const envDefaultEnabled = (this.deps.env.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0') === '1';
    const autoBindPolicy = resolveTeamPlanAutoBindPolicy(
      (workspaceRecord?.settings as Record<string, unknown> | undefined) ?? {},
      envDefaultEnabled,
    );
    const parsed = plannerOutputSchema.parse({
      team: plan.team,
      agents: padPlannerAgentsForSchemaValidation(plan.agents),
      graph: plan.graph,
      executionChecklist: plan.executionChecklist ?? [],
      requiredPacks: plan.requiredPacks ?? [],
      requiredTools: plan.requiredTools ?? [],
    });
    const { preview } = await this.buildBindPreview(workspaceId, parsed, autoBindPolicy, plan.bindOverrides);
    const requested = [...new Set(actionIds.map((a) => a.trim()).filter(Boolean))];
    const reactivatedToolDefinitionIds: string[] = [];
    for (const actionId of requested) {
      const def = preview.toolDefinitions.find((d) => d.actionId === actionId);
      if (!def || def.currentStatus !== 'existing_disabled' || !def.toolDefinitionId) continue;
      const updated = await this.deps.workspaceToolDefinitionRepo.update(workspaceId, def.toolDefinitionId, {
        enabled: true,
      });
      if (updated) reactivatedToolDefinitionIds.push(updated.id);
    }
    const { preview: freshPreview } = await this.buildBindPreview(
      workspaceId,
      parsed,
      autoBindPolicy,
      plan.bindOverrides,
    );
    return { preview: freshPreview, reactivatedToolDefinitionIds };
  }

  async executePlan(
    workspaceId: string,
    id: string,
    operationId?: string,
    opts?: {
      onPhase?: (
        phase: 'creating_agents' | 'binding_tools' | 'creating_team' | 'graph' | 'activate',
        detail?: string,
      ) => void;
      actorUserId?: string;
      correlationId?: string;
    },
  ): Promise<{
    plan: NonNullable<Awaited<ReturnType<TeamPlanRepository['findById']>>>;
    responseMeta: Record<string, unknown>;
  }> {
    const onPhase = opts?.onPhase;
    const workspaceRecord = await this.deps.workspaceRepo.findById(workspaceId);
    const envDefaultEnabled = (this.deps.env.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0') === '1';
    const autoBindPolicy = resolveTeamPlanAutoBindPolicy(
      (workspaceRecord?.settings as Record<string, unknown> | undefined) ?? {},
      envDefaultEnabled,
    );
    const autoBind = autoBindPolicy.autoBindEnabled;
    const executeMetrics = startTeamPlanExecuteMetrics(autoBind);
    const plan = await this.repo.findById(workspaceId, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (operationId && plan.lastOperationId && plan.lastOperationId === operationId && plan.result) {
      executeMetrics.observeResult('idempotent');
      return { plan, responseMeta: {} };
    }
    const parsed = plannerOutputSchema.parse({
      team: plan.team,
      agents: padPlannerAgentsForSchemaValidation(plan.agents),
      graph: plan.graph,
      executionChecklist: plan.executionChecklist ?? [],
      requiredPacks: plan.requiredPacks ?? [],
      requiredTools: plan.requiredTools ?? [],
    });
    const adequacy = evaluateTeamPlanAdequacy({
      plan: {
        team: parsed.team,
        agents: parsed.agents,
        requiredPacks: parsed.requiredPacks,
        requiredTools: parsed.requiredTools,
      },
      briefing: (plan.briefing as ITeamPlannerStructuredBriefing | undefined) ?? undefined,
    });
    if (adequacy.status === 'inadequate') {
      throw new AppError('PLAN_INADEQUATE', 'Plano inadequado para execução. Revise o plano antes de executar.', 422, {
        adequacy,
      });
    }
    assertSpecialistWorkflowOwnership(parsed.agents);
    assertSpecialistsExclusiveCatalogTools(materializePlannerAgentCatalogTools(parsed));
    const planAgentKeys = plannerAgentKeys(parsed.agents);
    const coordinator = parsed.agents.find((a) => a.role === 'coordinator');
    if (!coordinator) throw new AppError('VALIDATION_ERROR', 'Plano precisa de um coordenador', 400);

    let responseMeta: Record<string, unknown> = {};
    const conflictAgents = parsed.agents.filter((agent) => agent.planningMode === 'conflict');
    if (conflictAgents.length > 0) {
      const overlapMode = await getWorkspaceOverlapMode(this.deps, workspaceId);
      if (overlapMode === 'blocking') {
        await this.deps.governanceAuditRepo.append({
          workspaceId,
          userId: opts?.actorUserId,
          correlationId: opts?.correlationId,
          eventType: 'governance.team_plan_blocked',
          payload: { teamPlanId: id, reason: 'overlap_conflict' },
        });
        throw new AppError('CONFLICT', 'Plano contem conflitos de reuso/overlap; ajuste antes de executar', 409);
      }
      await this.deps.governanceAuditRepo.append({
        workspaceId,
        userId: opts?.actorUserId,
        correlationId: opts?.correlationId,
        eventType: 'governance.overlap_warning_allowed',
        payload: { route: 'team_plan.execute', teamPlanId: id, reason: 'overlap_conflict' },
      });
      responseMeta.governanceWarning = {
        decision: 'block',
        conflicts: conflictAgents.map((a) => ({
          agentName: a.name,
          overlapScore: a.overlapScore,
          overlapReason: a.overlapReason,
        })),
      };
    }

    const newAgentCreations = parsed.agents.filter(
      (a) => !(a.planningMode === 'existing' && a.existingAgentId),
    ).length;
    await assertWorkspaceQuotaDelta(this.deps.settingsRepo, workspaceId, {
      agents: newAgentCreations,
      teams: 1,
    });

    await this.repo.update(workspaceId, id, { status: 'executing', lastOperationId: operationId });

    try {
      onPhase?.('creating_agents', 'Criando coordenador e especialistas');
      const createdAgentRows: Array<{
        id: string;
        role: 'coordinator' | 'specialist';
        name: string;
        reused?: boolean;
        planAgentKey: string;
      }> = [];
      let createdCoordinator:
        | { id: string; role: 'coordinator' | 'specialist'; name: string; reused?: boolean; planAgentKey: string }
        | undefined;
      let specialistOrdinal = 0;
      for (const [index, plannedAgent] of parsed.agents.entries()) {
        const planAgentKey = planAgentKeys[index] ?? `agent-${index + 1}`;
        if (plannedAgent.planningMode === 'existing' && plannedAgent.existingAgentId) {
          const existing = await this.deps.agentRepo.findById(workspaceId, plannedAgent.existingAgentId);
          if (!existing) {
            throw new AppError('VALIDATION_ERROR', `Agente reutilizado nao encontrado: ${plannedAgent.existingAgentId}`, 400);
          }
          if (
            plannedAgent.role === 'specialist' &&
            plannedAgent.exampleUserPhrases.length >= PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN
          ) {
            const exRecord = existing as Record<string, unknown>;
            const exDomain = (exRecord['domain'] as Record<string, unknown> | undefined) ?? {};
            const rawPrev = exDomain['exampleUserPhrases'];
            const prevPhrases = Array.isArray(rawPrev)
              ? rawPrev.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              : [];
            if (prevPhrases.length === 0) {
              await this.deps.agentRepo.update(workspaceId, existing.id, {
                domain: {
                  ...exDomain,
                  exampleUserPhrases: plannedAgent.exampleUserPhrases,
                },
              });
            }
          }
          const reused = {
            id: existing.id,
            role: plannedAgent.role,
            name: existing.name,
            reused: true,
            planAgentKey,
          };
          createdAgentRows.push(reused);
          if (plannedAgent.role === 'coordinator') createdCoordinator = reused;
          continue;
        }
        const specialistIndex = plannedAgent.role === 'specialist' ? specialistOrdinal++ : 0;
        const catalogTools = resolveCatalogToolsForPlanAgent(plannedAgent, {
          plan: parsed,
          specialistIndex,
        });
        const domainForSpecialist =
          plannedAgent.role === 'specialist' && plannedAgent.exampleUserPhrases.length > 0
            ? {
                exampleUserPhrases: plannedAgent.exampleUserPhrases,
                inputDescription: (plannedAgent.description ?? '').slice(0, 500),
                summary: (plannedAgent.objective ?? '').slice(0, 500),
              }
            : undefined;
        const created = await this.deps.agentRepo.create(workspaceId, {
          name: plannedAgent.name,
          description: plannedAgent.description ?? '',
          role: plannedAgent.role,
          origin: 'company',
          skills: plannedAgent.skills,
          category: normalizeAgentCategory(plannedAgent.category),
          channels: plannedAgent.role === 'coordinator' ? plannedAgent.channels ?? [] : [],
          status: 'active',
          version: '1.0.0',
          goal: plannedAgent.objective,
          responsibilities: plannedAgent.responsibilities,
          ...(domainForSpecialist ? { domain: domainForSpecialist } : {}),
          ...(plannedAgent.role === 'coordinator'
            ? { systemInstruction: ensureCoordinatorSystemInstructionPolicy() }
            : {}),
          capabilities: { tools: catalogTools },
        });
        const createdRow = {
          id: String(created.id),
          role: plannedAgent.role,
          name: plannedAgent.name,
          reused: false,
          planAgentKey,
        };
        createdAgentRows.push(createdRow);
        if (plannedAgent.role === 'coordinator') createdCoordinator = createdRow;
      }
      if (!createdCoordinator) {
        throw new AppError('VALIDATION_ERROR', 'Plano precisa resolver um coordenador valido', 400);
      }

      const { actionIdsFull, actionIdsTruncated, selectedActionIds, bindOverrides, preview } = await this.buildBindPreview(
        workspaceId,
        parsed,
        autoBindPolicy,
        plan.bindOverrides,
      );
      let boundToolDefinitionIds: string[] = [];
      let reusedAgentsUpdated = 0;
      let reusedAgentsSkipped = 0;
      const effectiveBindEnabled = preview.effectiveBindEnabled;
      const reactivatedToolDefinitionIds: string[] = [];
      if (effectiveBindEnabled && selectedActionIds.length > 0) {
        onPhase?.(
          'binding_tools',
          `Vinculando ${selectedActionIds.length} acao(oes) de negocio; reused=${autoBindPolicy.reusedAgentBindMode}`,
        );
        for (const actionId of selectedActionIds) {
          const def = preview.toolDefinitions.find((d) => d.actionId === actionId);
          if (def?.currentStatus === 'existing_disabled' && def.toolDefinitionId) {
            const updated = await this.deps.workspaceToolDefinitionRepo.update(workspaceId, def.toolDefinitionId, {
              enabled: true,
            });
            if (updated) reactivatedToolDefinitionIds.push(updated.id);
          }
        }
        const actionIdToToolDefinitionId = new Map<string, string>();
        for (const definition of preview.toolDefinitions) {
          if (definition.toolDefinitionId) actionIdToToolDefinitionId.set(definition.actionId, definition.toolDefinitionId);
        }
        const missingActionIds = selectedActionIds.filter((actionId) => !actionIdToToolDefinitionId.has(actionId));
        const ensuredDefinitionIds = await ensureInternalActionDefinitions(
          workspaceId,
          missingActionIds,
          this.deps.workspaceToolDefinitionRepo,
        );
        missingActionIds.forEach((actionId, index) => {
          const toolDefinitionId = ensuredDefinitionIds[index];
          if (toolDefinitionId) actionIdToToolDefinitionId.set(actionId, toolDefinitionId);
        });
        boundToolDefinitionIds = [...new Set(
          selectedActionIds
            .map((actionId) => actionIdToToolDefinitionId.get(actionId))
            .filter((value): value is string => typeof value === 'string'),
        )];
        const previewByAgentKey = new Map(preview.agents.map((agent) => [agent.planAgentKey, agent]));
        for (const row of createdAgentRows) {
          const agentPreview = previewByAgentKey.get(row.planAgentKey);
          if (row.reused && agentPreview && !agentPreview.effectiveBindEnabled) {
            reusedAgentsSkipped += 1;
            continue;
          }
          const toolDefinitionIdsToLink = [...new Set(
            (agentPreview?.actionIdsToLink ?? [])
              .map((actionId) => actionIdToToolDefinitionId.get(actionId))
              .filter((value): value is string => typeof value === 'string'),
          )];
          if (toolDefinitionIdsToLink.length === 0) continue;
          const agentRow = await this.deps.agentRepo.findById(workspaceId, row.id);
          if (!agentRow) continue;
          const cap = (agentRow.capabilities as Record<string, unknown> | undefined) ?? {};
          const prev = Array.isArray(cap['customToolDefinitionIds'])
            ? (cap['customToolDefinitionIds'] as unknown[]).filter((x): x is string => typeof x === 'string')
            : [];
          const merged = [...new Set([...prev, ...toolDefinitionIdsToLink])];
          await this.deps.agentRepo.update(workspaceId, row.id, {
            capabilities: { ...cap, customToolDefinitionIds: merged },
          });
          if (row.reused) reusedAgentsUpdated += 1;
        }
      } else {
        reusedAgentsSkipped = preview.agents.filter((agent) => agent.planningMode === 'existing' && !agent.effectiveBindEnabled).length;
      }

      if (actionIdsFull.length > 0) {
        const summary = {
          event: 'team_plan.auto_bind_summary' as const,
          workspaceId,
          teamPlanId: id,
          correlationId: opts?.correlationId,
          autoBindEnabled: autoBind,
          effectiveBindEnabled,
          autoBindPolicySource: autoBindPolicy.source,
          autoBindMode: autoBindPolicy.autoBindMode,
          reusedAgentBindMode: autoBindPolicy.reusedAgentBindMode,
          actionsRequested: actionIdsFull.length,
          actionsAfterCap: selectedActionIds.length,
          actionsTruncated: actionIdsTruncated,
          bindOverrides,
          bindOverridesApplied: preview.bindOverridesApplied,
          boundToolDefinitionCount: boundToolDefinitionIds.length,
          newAgentsUpdated: createdAgentRows.filter((a) => !a.reused).length,
          reusedAgentsUpdated,
          reusedAgentsSkipped,
        };
        if (actionIdsTruncated) {
          log.warn(
            { ...summary, cap: TEAM_PLAN_AUTO_BIND_MAX_ACTIONS },
            'team plan: requiredTools/requiredPacks list truncated to cap before bind',
          );
        } else {
          log.info(summary, 'team plan: auto-bind summary');
        }
      }

      const specialistIds = createdAgentRows.filter((a) => a.role === 'specialist').map((a) => a.id);

      onPhase?.('creating_team', 'Criando time (draft)');
      const team = await this.deps.teamRepo.create(workspaceId, {
        name: parsed.team.name,
        description: parsed.team.description ?? '',
        objective: parsed.team.objective,
        coordinatorId: createdCoordinator.id,
        agentIds: specialistIds,
        channelIds: parsed.team.channelIds,
        primaryChannel: parsed.team.primaryChannel,
        singleAgentMode: parsed.team.singleAgentMode === true,
        status: 'draft',
      });

      onPhase?.('graph', 'Validando e aplicando grafo');
      const graphAgentMap = new Map<string, string>();
      graphAgentMap.set('coordinator', String(createdCoordinator.id));
      let specialistCursor = 0;
      for (const created of createdAgentRows.filter((a) => a.role === 'specialist')) {
        specialistCursor += 1;
        graphAgentMap.set(`specialist-${specialistCursor}`, created.id);
      }
      const graphNodes = parsed.graph.nodes.map((n) => {
        const node = n as IGraphNode;
        const d = (node.data ?? {}) as Record<string, unknown>;
        const key = typeof d.agentId === 'string' ? d.agentId : undefined;
        if (key && graphAgentMap.has(key)) {
          return { ...node, data: { ...d, agentId: graphAgentMap.get(key) } };
        }
        return node;
      });
      const graphValidation = validateTeamGraph(
        graphNodes as IGraphNode[],
        parsed.graph.edges as Array<{ id: string; source: string; target: string }>,
        {
          agentIds: await this.deps.agentRepo.listAllIds(workspaceId),
          channelIds: await this.deps.channelRepo.listAllIds(workspaceId),
        },
        {
          team: {
            coordinatorId: String(createdCoordinator.id),
            agentIds: specialistIds,
            channelIds: parsed.team.channelIds,
          },
        },
      );
      if (!graphValidation.valid) {
        throw new AppError('VALIDATION_ERROR', graphValidation.errors.map((e) => e.message).join(' '), 400);
      }
      await this.deps.teamGraphRepo.upsert(workspaceId, String(team.id), graphNodes, parsed.graph.edges);

      onPhase?.('activate', 'Ativando time');
      await assertActiveChannelBindingUnique(this.deps.teamRepo, workspaceId, parsed.team.channelIds, String(team.id));
      await this.deps.teamRepo.update(workspaceId, String(team.id), { status: 'active' });

      const result = {
        teamId: String(team.id),
        coordinatorId: String(createdCoordinator.id),
        specialistIds,
        createdAgents: createdAgentRows.map(({ id: agentId, role, name, reused }) => ({
          id: agentId,
          role,
          name,
          reused,
        })),
        activatedAt: new Date().toISOString(),
      };
      const updated = await this.repo.update(workspaceId, id, {
        status: 'executed',
        result,
        lastOperationId: operationId,
      });
      if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
      const reusedCount = createdAgentRows.filter((a) => a.reused).length;
      const newCount = createdAgentRows.filter((a) => !a.reused).length;
      await this.deps.governanceAuditRepo.append({
        workspaceId,
        userId: opts?.actorUserId,
        correlationId: opts?.correlationId,
        eventType: 'governance.team_plan_execute',
        payload: {
          teamPlanId: id,
          teamId: result.teamId,
          reusedAgents: reusedCount,
          newAgents: newCount,
          requiredPacks: parsed.requiredPacks,
          requiredTools: parsed.requiredTools,
          autoBindEnabled: autoBind,
          effectiveBindEnabled,
          autoBindPolicySource: autoBindPolicy.source,
          autoBindMode: autoBindPolicy.autoBindMode,
          reusedAgentBindMode: autoBindPolicy.reusedAgentBindMode,
          bindOverrides,
          bindOverridesApplied: preview.bindOverridesApplied,
          bindOverrideAgentCount: preview.bindOverrideAgentCount,
          bindOverrideActionCount: preview.bindOverrideActionCount,
          bindDiffSummary: preview.diffSummary,
          boundToolDefinitionIds,
          reactivatedToolDefinitionIds,
          autoBindActionsRequested: actionIdsFull.length,
          autoBindActionsTruncated: actionIdsTruncated,
          reusedAgentsUpdated,
          reusedAgentsSkipped,
        },
      });
      recordTeamPlanAutoBindMetrics({
        autoBindEnabled: effectiveBindEnabled,
        requested: actionIdsFull.length,
        applied: selectedActionIds.length,
        truncated: actionIdsTruncated,
      });
      responseMeta.requiredPacks = parsed.requiredPacks;
      responseMeta.requiredTools = parsed.requiredTools;
      responseMeta.autoBindEnabled = autoBind;
      responseMeta.effectiveBindEnabled = effectiveBindEnabled;
      responseMeta.autoBindPolicySource = autoBindPolicy.source;
      responseMeta.autoBindMode = autoBindPolicy.autoBindMode;
      responseMeta.reusedAgentBindMode = autoBindPolicy.reusedAgentBindMode;
      responseMeta.bindOverridesApplied = preview.bindOverridesApplied;
      responseMeta.bindOverrideAgentCount = preview.bindOverrideAgentCount;
      responseMeta.bindOverrideActionCount = preview.bindOverrideActionCount;
      responseMeta.bindDiffSummary = preview.diffSummary;
      responseMeta.boundToolDefinitionIds = boundToolDefinitionIds;
      responseMeta.autoBindActionsRequested = actionIdsFull.length;
      responseMeta.autoBindActionsApplied = selectedActionIds.length;
      responseMeta.autoBindActionsTruncated = actionIdsTruncated;
      responseMeta.reusedAgentsUpdated = reusedAgentsUpdated;
      responseMeta.reusedAgentsSkipped = reusedAgentsSkipped;
      responseMeta.reactivatedToolDefinitionIds = reactivatedToolDefinitionIds;
      executeMetrics.observeResult('success');
      return { plan: updated, responseMeta };
    } catch (err) {
      executeMetrics.observeResult('error');
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.update(workspaceId, id, { status: 'failed', result: { error: message }, lastOperationId: operationId });
      throw err;
    }
  }

  /**
   * Fluxo único: gera o plano (LLM ou fallback) e executa a materialização (agentes, bind, time).
   * Equivale a `createPlan` seguido de `executePlan` com o mesmo `operationId` opcional para correlacionar retries.
   */
  async createPlanAndExecute(
    workspaceId: string,
    input: { problem: string; context?: string; briefing?: ITeamPlannerStructuredBriefing },
    opts?: {
      operationId?: string;
      onPhase?: (
        phase: 'creating_agents' | 'binding_tools' | 'creating_team' | 'graph' | 'activate',
        detail?: string,
      ) => void;
      actorUserId?: string;
      correlationId?: string;
    },
  ): Promise<{
    plan: NonNullable<Awaited<ReturnType<TeamPlanRepository['findById']>>>;
    responseMeta: Record<string, unknown>;
  }> {
    const created = await this.createPlan(workspaceId, input);
    return this.executePlan(workspaceId, created.id, opts?.operationId, {
      onPhase: opts?.onPhase,
      actorUserId: opts?.actorUserId,
      correlationId: opts?.correlationId,
    });
  }
}
