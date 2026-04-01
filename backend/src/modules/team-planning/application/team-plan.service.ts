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

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' }).child({ module: 'team-plan' });

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
});

type TPlannerOutput = z.infer<typeof plannerOutputSchema>;

export class TeamPlanService {
  constructor(
    private readonly d: IAppDeps,
    private readonly repo: TeamPlanRepository,
  ) {}

  private buildFallback(problem: string, context?: string): TPlannerOutput {
    const short = problem.slice(0, 80);
    const objective = context?.trim()
      ? `${problem.trim()} Contexto: ${context.trim()}`
      : `${problem.trim()} Resolver com fluxo coordenado e previsivel.`;
    return {
      team: {
        name: `Time ${short}`.slice(0, 60),
        objective,
        description: `Plano gerado para: ${short}`,
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
    };
  }

  private buildDefaultGraph(plan: TPlannerOutput) {
    if (plan.graph.nodes.length > 0) return plan.graph;
    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<Record<string, unknown>> = [];
    const coord = plan.agents.find((a) => a.role === 'coordinator') ?? plan.agents[0];
    const coordNodeId = 'coordinator-0';
    nodes.push({
      id: coordNodeId,
      type: 'coordinator',
      data: { label: coord.name, agentId: 'coordinator' },
      position: { x: 200, y: 80 },
    });
    let idx = 0;
    for (const agent of plan.agents.filter((a) => a.role === 'specialist')) {
      idx += 1;
      const nid = `specialist-${idx}`;
      nodes.push({
        id: nid,
        type: 'specialist',
        data: { label: agent.name, agentId: `specialist-${idx}` },
        position: { x: 120 + idx * 180, y: 260 },
      });
      edges.push({ id: `e-${coordNodeId}-${nid}`, source: coordNodeId, target: nid, type: 'smoothstep' });
    }
    return { nodes, edges };
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
    const keyResolution = await this.d.workspaceIntegrationsService.resolveOpenAiApiKeyWithSource(workspaceId);
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

    const graph = this.buildDefaultGraph(raw);
    const created = await this.repo.create(workspaceId, {
      problem: input.problem,
      context: input.context,
      status: 'ready',
      team: raw.team,
      agents: raw.agents.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph,
      executionChecklist: raw.executionChecklist,
      plannerMeta: plannerMeta as unknown as Record<string, unknown>,
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
    });
    const updated = await this.repo.update(workspaceId, id, {
      team: parsed.team,
      agents: parsed.agents.map((a) => ({ ...a, category: normalizeAgentCategory(a.category) })),
      graph: parsed.graph,
      status: 'ready',
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    return updated;
  }

  async executePlan(
    workspaceId: string,
    id: string,
    operationId?: string,
    opts?: { onPhase?: (phase: 'creating_agents' | 'creating_team' | 'graph' | 'activate', detail?: string) => void },
  ) {
    const onPhase = opts?.onPhase;
    const plan = await this.repo.findById(workspaceId, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano nao encontrado', 404);
    if (operationId && plan.lastOperationId && plan.lastOperationId === operationId && plan.result) {
      return plan;
    }
    const parsed = plannerOutputSchema.parse({
      team: plan.team,
      agents: plan.agents,
      graph: plan.graph,
      executionChecklist: plan.executionChecklist ?? [],
    });
    const coordinator = parsed.agents.find((a) => a.role === 'coordinator');
    if (!coordinator) throw new AppError('VALIDATION_ERROR', 'Plano precisa de um coordenador', 400);
    await this.repo.update(workspaceId, id, { status: 'executing', lastOperationId: operationId });

    try {
      onPhase?.('creating_agents', 'Criando coordenador e especialistas');
      const createdAgents: Array<{ id: string; role: 'coordinator' | 'specialist'; name: string }> = [];
      const createdCoordinator = await this.d.agentRepo.create(workspaceId, {
        name: coordinator.name,
        description: coordinator.description ?? '',
        role: 'coordinator',
        origin: 'company',
        skills: coordinator.skills,
        category: normalizeAgentCategory(coordinator.category),
        channels: coordinator.channels ?? [],
        status: 'active',
        version: '1.0.0',
        goal: coordinator.objective,
        responsibilities: coordinator.responsibilities,
      });
      createdAgents.push({ id: String(createdCoordinator.id), role: 'coordinator', name: coordinator.name });
      for (const specialist of parsed.agents.filter((a) => a.role === 'specialist')) {
        const created = await this.d.agentRepo.create(workspaceId, {
          name: specialist.name,
          description: specialist.description ?? '',
          role: 'specialist',
          origin: 'company',
          skills: specialist.skills,
          category: normalizeAgentCategory(specialist.category),
          channels: [],
          status: 'active',
          version: '1.0.0',
          goal: specialist.objective,
          responsibilities: specialist.responsibilities,
        });
        createdAgents.push({ id: String(created.id), role: 'specialist', name: specialist.name });
      }

      const specialistIds = createdAgents.filter((a) => a.role === 'specialist').map((a) => a.id);

      onPhase?.('creating_team', 'Criando time (draft)');
      const team = await this.d.teamRepo.create(workspaceId, {
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
          agentIds: await this.d.agentRepo.listAllIds(workspaceId),
          channelIds: await this.d.channelRepo.listAllIds(workspaceId),
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
      await this.d.teamGraphRepo.upsert(workspaceId, String(team.id), graphNodes, parsed.graph.edges);

      onPhase?.('activate', 'Ativando time');
      await assertActiveChannelBindingUnique(this.d.teamRepo, workspaceId, parsed.team.channelIds, String(team.id));
      await this.d.teamRepo.update(workspaceId, String(team.id), { status: 'active' });

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
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.update(workspaceId, id, { status: 'failed', result: { error: message }, lastOperationId: operationId });
      throw err;
    }
  }
}
