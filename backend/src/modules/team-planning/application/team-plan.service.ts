import { z } from 'zod';
import pino from 'pino';
import { AppError } from '../../../shared/errors/app-error.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import { validateTeamGraph } from '../../graphs/domain/graph-validator.js';
import { assertActiveChannelBindingUnique } from '../../teams/application/assert-active-channel-binding.js';
import type { IAppDeps } from '../../../config/container.js';
import type { IGraphNode } from '../../graphs/domain/graph-types.js';
import type { TeamPlanRepository } from '../infra/team-plan.repository.js';
import { fetchTeamPlanJsonCompletion, teamPlanModelFromEnv } from './team-plan-json-completion.js';
import { TEAM_PLANNER_SYSTEM_PROMPT, buildTeamPlannerUserMessage } from './team-plan-planner-prompt.js';
import type { IAgentGovernanceDraft } from '../../agent-governance/domain/agent-governance.types.js';
import { getWorkspaceOverlapMode } from '../../governance/application/workspace-overlap-mode.js';
import { collectPlannerActionIds } from './planner-pack-presets.js';
import { ensureInternalActionDefinitions } from './ensure-planner-tool-definitions.js';
import { recordTeamPlanAutoBindMetrics, startTeamPlanExecuteMetrics } from '../../../app/metrics.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' }).child({ module: 'team-plan' });

/** Limite de actionIds processados por execução (evita abuso / payloads enormes). */
const TEAM_PLAN_AUTO_BIND_MAX_ACTIONS = 64;

/** Metadados persistidos em plannerMeta (API). */
export interface ITeamPlannerMeta {
  usedOpenAi: boolean;
  usedFallback: boolean;
  fallbackReason?: string;
  openaiResolvedFromEnv: boolean;
  parseErrorSummary?: string;
}

const plannerOutputSchema = z.object({
  team: z.object({
    name: z.string().min(3),
    objective: z.string().min(10),
    description: z.string().default(''),
    primaryChannel: z.enum(['whatsapp', 'slack', 'email', 'api']).optional(),
    channelIds: z.array(z.string()).default([]),
  }),
  agents: z
    .array(
      z.object({
        name: z.string().min(2),
        role: z.enum(['coordinator', 'specialist']),
        description: z.string().default(''),
        objective: z.string().default(''),
        responsibilities: z.array(z.string()).default([]),
        skills: z.array(z.string()).default([]),
        category: z.string().default('geral'),
        channels: z.array(z.enum(['whatsapp', 'slack', 'email', 'api'])).default([]),
        planningMode: z.enum(['existing', 'new', 'split_required', 'conflict']).optional(),
        existingAgentId: z.string().optional().nullable(),
        overlapScore: z.number().optional(),
        overlapReason: z.string().optional(),
      }),
    )
    .min(1),
  graph: z
    .object({
      nodes: z.array(z.unknown()).default([]),
      edges: z.array(z.unknown()).default([]),
    })
    .default({ nodes: [], edges: [] }),
  executionChecklist: z.array(z.string()).default([]),
  /** Packs de negocio sugeridos (ETAPA 8 / Loop 26). */
  requiredPacks: z.array(z.string()).default([]),
  /** actionIds de business tools sugeridos para bind aos agentes. */
  requiredTools: z.array(z.string()).default([]),
});

type TPlannerOutput = z.infer<typeof plannerOutputSchema>;

export class TeamPlanService {
  constructor(
    private readonly deps: IAppDeps,
    private readonly repo: TeamPlanRepository,
  ) {}

  private buildFallback(problem: string, context?: string): TPlannerOutput {
    const problemPreview = problem.slice(0, 80);
    const objective = context?.trim()
      ? `${problem.trim()} Contexto: ${context.trim()}`
      : `${problem.trim()} Resolver com fluxo coordenado e previsivel.`;
    return {
      team: {
        name: `Time ${problemPreview}`.slice(0, 60),
        objective,
        description: `Plano gerado para: ${problemPreview}`,
        primaryChannel: 'api',
        channelIds: [],
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

  async createPlan(workspaceId: string, input: { problem: string; context?: string }) {
    const keyResolution = await this.deps.workspaceIntegrationsService.resolveOpenAiApiKeyWithSource(workspaceId);
    const apiKey = keyResolution.apiKey;
    const openaiResolvedFromEnv = keyResolution.source === 'environment';

    let raw: TPlannerOutput;
    let plannerMeta: ITeamPlannerMeta;

    if (!apiKey) {
      raw = this.buildFallback(input.problem, input.context);
      plannerMeta = {
        usedOpenAi: false,
        usedFallback: true,
        fallbackReason: 'no_openai_key',
        openaiResolvedFromEnv: false,
      };
    } else {
      try {
        const model = teamPlanModelFromEnv();
        const { content } = await fetchTeamPlanJsonCompletion({
          apiKey,
          model,
          systemPrompt: TEAM_PLANNER_SYSTEM_PROMPT,
          userMessage: buildTeamPlannerUserMessage(input.problem, input.context),
        });
        const extracted = this.extractJsonLoose(content);
        if (extracted === null) {
          log.warn({ workspaceId }, 'team plan: JSON nao extraido da resposta OpenAI');
          raw = this.buildFallback(input.problem, input.context);
          plannerMeta = {
            usedOpenAi: false,
            usedFallback: true,
            fallbackReason: 'json_extract_failed',
            openaiResolvedFromEnv,
          };
        } else {
          const parsed = plannerOutputSchema.safeParse(extracted);
          if (parsed.success) {
            raw = parsed.data;
            plannerMeta = {
              usedOpenAi: true,
              usedFallback: false,
              openaiResolvedFromEnv,
            };
          } else {
            const parseSummary = parsed.error.message.slice(0, 400);
            log.warn({ workspaceId, zod: parseSummary }, 'team plan: JSON nao passou na validacao');
            raw = this.buildFallback(input.problem, input.context);
            plannerMeta = {
              usedOpenAi: false,
              usedFallback: true,
              fallbackReason: 'schema_validation_failed',
              openaiResolvedFromEnv,
              parseErrorSummary: parseSummary,
            };
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ workspaceId, err: msg }, 'team plan: falha na chamada OpenAI');
        raw = this.buildFallback(input.problem, input.context);
        plannerMeta = {
          usedOpenAi: false,
          usedFallback: true,
          fallbackReason: 'openai_request_failed',
          openaiResolvedFromEnv,
          parseErrorSummary: msg.slice(0, 400),
        };
      }
    }

    const reuse = await this.annotateAgentsWithReuse(workspaceId, raw.agents);
    const graph = this.buildDefaultGraph({ ...raw, agents: reuse.agents });
    const created = await this.repo.create(workspaceId, {
      problem: input.problem,
      context: input.context,
      status: 'ready',
      team: raw.team,
      agents: reuse.agents.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph,
      executionChecklist: raw.executionChecklist,
      requiredPacks: raw.requiredPacks,
      requiredTools: raw.requiredTools,
      plannerMeta: {
        ...(plannerMeta as unknown as Record<string, unknown>),
        platformAssistant: 'team-crafter',
      },
      reuseSummary: reuse.reuseSummary,
    });
    return created;
  }

  async updatePlan(workspaceId: string, id: string, patch: { team?: unknown; agents?: unknown; graph?: unknown }) {
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
      ...next,
      executionChecklist: current.executionChecklist ?? [],
      requiredPacks: current.requiredPacks ?? [],
      requiredTools: current.requiredTools ?? [],
    });
    const reuse = await this.annotateAgentsWithReuse(workspaceId, parsed.agents);
    const updated = await this.repo.update(workspaceId, id, {
      team: parsed.team,
      agents: reuse.agents.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph: parsed.graph,
      status: 'ready',
      reuseSummary: reuse.reuseSummary,
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    return updated;
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
    const autoBind = (this.deps.env.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0') === '1';
    const executeMetrics = startTeamPlanExecuteMetrics(autoBind);
    const plan = await this.repo.findById(workspaceId, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (operationId && plan.lastOperationId && plan.lastOperationId === operationId && plan.result) {
      executeMetrics.observeResult('idempotent');
      return { plan, responseMeta: {} };
    }
    const parsed = plannerOutputSchema.parse({
      team: plan.team,
      agents: plan.agents,
      graph: plan.graph,
      executionChecklist: plan.executionChecklist ?? [],
      requiredPacks: plan.requiredPacks ?? [],
      requiredTools: plan.requiredTools ?? [],
    });
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

    await this.repo.update(workspaceId, id, { status: 'executing', lastOperationId: operationId });

    try {
      onPhase?.('creating_agents', 'Criando coordenador e especialistas');
      const createdAgents: Array<{ id: string; role: 'coordinator' | 'specialist'; name: string; reused?: boolean }> = [];
      let createdCoordinator:
        | { id: string; role: 'coordinator' | 'specialist'; name: string; reused?: boolean }
        | undefined;
      for (const plannedAgent of parsed.agents) {
        if (plannedAgent.planningMode === 'existing' && plannedAgent.existingAgentId) {
          const existing = await this.deps.agentRepo.findById(workspaceId, plannedAgent.existingAgentId);
          if (!existing) {
            throw new AppError('VALIDATION_ERROR', `Agente reutilizado nao encontrado: ${plannedAgent.existingAgentId}`, 400);
          }
          const reused = {
            id: existing.id,
            role: plannedAgent.role,
            name: existing.name,
            reused: true,
          };
          createdAgents.push(reused);
          if (plannedAgent.role === 'coordinator') createdCoordinator = reused;
          continue;
        }
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
        });
        const createdRow = {
          id: String(created.id),
          role: plannedAgent.role,
          name: plannedAgent.name,
          reused: false,
        };
        createdAgents.push(createdRow);
        if (plannedAgent.role === 'coordinator') createdCoordinator = createdRow;
      }
      if (!createdCoordinator) {
        throw new AppError('VALIDATION_ERROR', 'Plano precisa resolver um coordenador valido', 400);
      }

      const actionIdsFull = collectPlannerActionIds(parsed.requiredTools, parsed.requiredPacks);
      const actionIdsTruncated = actionIdsFull.length > TEAM_PLAN_AUTO_BIND_MAX_ACTIONS;
      const actionIds = actionIdsFull.slice(0, TEAM_PLAN_AUTO_BIND_MAX_ACTIONS);
      let boundToolDefinitionIds: string[] = [];
      if (autoBind && actionIds.length > 0) {
        onPhase?.('binding_tools', `Vinculando ${actionIds.length} acao(oes) de negocio aos agentes novos`);
        boundToolDefinitionIds = await ensureInternalActionDefinitions(
          workspaceId,
          actionIds,
          this.deps.workspaceToolDefinitionRepo,
        );
        for (const row of createdAgents) {
          if (row.reused) continue;
          const agentRow = await this.deps.agentRepo.findById(workspaceId, row.id);
          if (!agentRow) continue;
          const cap = (agentRow.capabilities as Record<string, unknown> | undefined) ?? {};
          const prev = Array.isArray(cap['customToolDefinitionIds'])
            ? (cap['customToolDefinitionIds'] as unknown[]).filter((x): x is string => typeof x === 'string')
            : [];
          const merged = [...new Set([...prev, ...boundToolDefinitionIds])];
          await this.deps.agentRepo.update(workspaceId, row.id, {
            capabilities: { ...cap, customToolDefinitionIds: merged },
          });
        }
      }

      if (actionIdsFull.length > 0) {
        const summary = {
          event: 'team_plan.auto_bind_summary' as const,
          workspaceId,
          teamPlanId: id,
          correlationId: opts?.correlationId,
          autoBindEnabled: autoBind,
          actionsRequested: actionIdsFull.length,
          actionsAfterCap: actionIds.length,
          actionsTruncated: actionIdsTruncated,
          boundToolDefinitionCount: boundToolDefinitionIds.length,
          newAgentsUpdated: createdAgents.filter((a) => !a.reused).length,
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

      const specialistIds = createdAgents.filter((a) => a.role === 'specialist').map((a) => a.id);

      onPhase?.('creating_team', 'Criando time (draft)');
      const team = await this.deps.teamRepo.create(workspaceId, {
        name: parsed.team.name,
        description: parsed.team.description ?? '',
        objective: parsed.team.objective,
        coordinatorId: createdCoordinator.id,
        agentIds: specialistIds,
        channelIds: parsed.team.channelIds,
        primaryChannel: parsed.team.primaryChannel,
        status: 'draft',
      });

      onPhase?.('graph', 'Validando e aplicando grafo');
      const graphAgentMap = new Map<string, string>();
      graphAgentMap.set('coordinator', String(createdCoordinator.id));
      let specialistCursor = 0;
      for (const created of createdAgents.filter((a) => a.role === 'specialist')) {
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
        createdAgents,
        activatedAt: new Date().toISOString(),
      };
      const updated = await this.repo.update(workspaceId, id, {
        status: 'executed',
        result,
        lastOperationId: operationId,
      });
      if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
      const reusedCount = createdAgents.filter((a) => a.reused).length;
      const newCount = createdAgents.filter((a) => !a.reused).length;
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
          boundToolDefinitionIds,
          autoBindActionsRequested: actionIdsFull.length,
          autoBindActionsTruncated: actionIdsTruncated,
        },
      });
      recordTeamPlanAutoBindMetrics({
        autoBindEnabled: autoBind,
        requested: actionIdsFull.length,
        applied: autoBind ? actionIds.length : 0,
        truncated: actionIdsTruncated,
      });
      responseMeta.requiredPacks = parsed.requiredPacks;
      responseMeta.requiredTools = parsed.requiredTools;
      responseMeta.autoBindEnabled = autoBind;
      responseMeta.boundToolDefinitionIds = boundToolDefinitionIds;
      responseMeta.autoBindActionsRequested = actionIdsFull.length;
      responseMeta.autoBindActionsApplied = autoBind ? actionIds.length : 0;
      responseMeta.autoBindActionsTruncated = actionIdsTruncated;
      executeMetrics.observeResult('success');
      return { plan: updated, responseMeta };
    } catch (err) {
      executeMetrics.observeResult('error');
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.update(workspaceId, id, { status: 'failed', result: { error: message }, lastOperationId: operationId });
      throw err;
    }
  }
}
