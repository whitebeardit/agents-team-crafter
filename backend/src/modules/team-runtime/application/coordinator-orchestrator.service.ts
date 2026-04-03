import { randomUUID } from 'node:crypto';
import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import type { TeamRepository } from '../../teams/infra/team.repository.js';
import type { AgentMcpBindingRepository } from '../../agents/infra/agent-mcp-binding.repository.js';
import type { McpConnectionRepository } from '../../mcps/infra/mcp-connection.repository.js';
import type { KnowledgeSourceRepository } from '../../knowledge/infra/knowledge-source.repository.js';
import type {
  IAgentRuntimeProvider,
  IWorkspaceCustomToolDefinition,
  TRuntimeEvent,
} from '../../runtime/ports/agent-runtime.provider.js';
import type { WorkspaceToolDefinitionRepository } from '../../tool-definitions/infra/workspace-tool-definition.repository.js';
import { composeExecutableAgentConfig } from '../../runtime/application/compose-executable-config.js';
import { buildSpecialistSystemInstruction } from '../../runtime/application/build-specialist-system-instruction.js';
import { buildKnowledgeAppendixForAgent } from '../../runtime/application/build-knowledge-appendix.js';
import { loadMcpToolSpecsForAgent } from '../../runtime/application/load-mcp-tool-specs.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ISpecialistResult } from '../domain/specialist-result.js';
import type { ITeamExecutionEvent, ITeamExecutionResult } from '../domain/team-execution-result.js';
import type { ITeamProgressEvent } from '../domain/team-progress-event.js';
import {
  assertSpecialistAgentRow,
  assertTeamCoordinatorBinding,
  listSpecialistIds,
} from '../domain/team-runtime-invariants.js';
import { assertInvocationMatchesTeam } from './team-runtime-guards.service.js';
import { composeExternalResponseFromModelText } from './response-composer.service.js';
import { formatCoordinatorUserMessage } from './format-coordinator-user-message.js';
import { buildSpecialistRuntimeMessage } from './build-specialist-runtime-message.js';
import {
  resolveSpecialistAgentIdFromToolName,
  SpecialistRegistry,
} from '../infra/registries/specialist-registry.js';
import type { WorkspaceIntegrationsService } from '../../settings/application/workspace-integrations.service.js';

const ACTIVITY_MAX = 200;

/** Appended to the coordinator system instruction so tool calls stay explicit. */
const COORDINATOR_SPECIALIST_TOOL_GUIDANCE = `

## Ferramentas de especialistas
Cada chamada recebe o parâmetro \`instruction\`. O sistema repassa automaticamente a **mensagem completa do utilizador** ao especialista quando ainda não estiver incluída nessa instrução; podes focar a \`instruction\` na tarefa e confiar nesse reenvio para código ou texto longo.

## Resposta final ao utilizador (imagens)
Quando um especialista devolver uma **URL HTTPS** de imagem gerada (por exemplo após usar a tool de geração de imagens) ou Markdown \`![descricao](https://...)\`, **inclui obrigatoriamente** essa linha Markdown na tua resposta final, para a interface e o Telegram mostrarem a imagem. Não substituas por apenas uma descrição textual se existir URL disponível.`;

function truncateActivity(text: string, max = ACTIVITY_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export interface ICoordinatorExecuteOptions {
  onProgress?: (e: ITeamProgressEvent) => void;
  streamCoordinatorText?: boolean;
  onCoordinatorTextDelta?: (text: string) => void;
}

function mapRuntimeEventToTeamEvent(e: TRuntimeEvent, rosterSpecialistIds: string[]): ITeamExecutionEvent {
  if (e.type === 'taskType') return { type: e.type, value: e.value };
  const agentId =
    e.tool !== undefined ? resolveSpecialistAgentIdFromToolName(e.tool, rosterSpecialistIds) : undefined;
  return {
    type: e.type,
    tool: e.tool,
    status: e.status,
    errorCode: e.errorCode,
    ...(agentId ? { agentId } : {}),
  };
}

export class CoordinatorOrchestratorService {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly teamRepo: TeamRepository,
    private readonly agentRuntime: IAgentRuntimeProvider,
    private readonly specialistRegistry: SpecialistRegistry,
    private readonly workspaceIntegrationsService: WorkspaceIntegrationsService,
    private readonly agentMcpBindingRepo: AgentMcpBindingRepository,
    private readonly mcpRepo: McpConnectionRepository,
    private readonly knowledgeSourceRepo: KnowledgeSourceRepository,
    private readonly workspaceToolDefinitionRepo: WorkspaceToolDefinitionRepository,
  ) {}

  async execute(
    invocation: ITeamInvocation,
    options?: ICoordinatorExecuteOptions,
  ): Promise<ITeamExecutionResult> {
    const ws = invocation.workspaceId;
    const team = await this.teamRepo.findById(ws, invocation.teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);

    const t = team as Record<string, unknown>;
    const teamRow = {
      id: String(t['id']),
      coordinatorId: String(t['coordinatorId']),
      agentIds: (t['agentIds'] as string[]) ?? [],
      name: String(t['name'] ?? ''),
    };

    assertInvocationMatchesTeam(invocation, teamRow);

    const runId = randomUUID();
    const emitProgress = (partial: Omit<ITeamProgressEvent, 'runId'>) => {
      options?.onProgress?.({ ...partial, runId });
    };

    const coordinator = await this.agentRepo.findById(ws, teamRow.coordinatorId);
    if (!coordinator) throw new AppError('NOT_FOUND', 'Coordenador nao encontrado', 404);
    assertTeamCoordinatorBinding(coordinator as Record<string, unknown>, teamRow.coordinatorId);

    const specialistIds = listSpecialistIds(teamRow);
    const specialists: Array<{ id: string; name: string; description?: string }> = [];
    for (const sid of specialistIds) {
      const a = await this.agentRepo.findById(ws, sid);
      if (!a) continue;
      const row = a as Record<string, unknown>;
      assertSpecialistAgentRow(row);
      specialists.push({
        id: String(row['id']),
        name: String(row['name'] ?? 'Specialist'),
        description: String(row['description'] ?? ''),
      });
    }

    const specialistResults: ISpecialistResult[] = [];
    const specialistSidecarEvents: ITeamExecutionEvent[] = [];

    const executeSpecialist = async (specialistAgentId: string, instruction: string) => {
      const runtimeMessage = buildSpecialistRuntimeMessage(instruction, invocation.message);
      specialistSidecarEvents.push({
        type: 'specialistStarted',
        agentId: specialistAgentId,
        phase: 'runStep',
        detail: truncateActivity(runtimeMessage),
        toolInstruction: instruction,
        runtimeMessage,
      });
      emitProgress({
        agentId: specialistAgentId,
        status: 'busy',
        phase: 'specialist',
        detail: truncateActivity(runtimeMessage),
      });

      const spec = await this.agentRepo.findById(ws, specialistAgentId);
      if (!spec) {
        const msg = 'Especialista nao encontrado.';
        specialistSidecarEvents.push({
          type: 'specialistFinished',
          agentId: specialistAgentId,
          phase: 'runStep',
          detail: msg,
        });
        emitProgress({
          agentId: specialistAgentId,
          status: 'idle',
          phase: 'specialist',
          detail: msg,
        });
        return msg;
      }
      assertSpecialistAgentRow(spec as Record<string, unknown>);
      const srow = spec as Record<string, unknown>;

      const knowledgeRow = srow['knowledge'] as { sources?: string[] } | undefined;
      const knowledgeSourceIds = Array.isArray(knowledgeRow?.sources)
        ? knowledgeRow.sources.filter((x): x is string => typeof x === 'string')
        : [];

      const knowledgeAppendix = await buildKnowledgeAppendixForAgent(
        ws,
        knowledgeSourceIds,
        this.knowledgeSourceRepo,
      );
      const systemInstruction = buildSpecialistSystemInstruction(srow, knowledgeAppendix);

      const mcpToolSpecs = await loadMcpToolSpecsForAgent(
        ws,
        specialistAgentId,
        this.agentMcpBindingRepo,
        this.mcpRepo,
      );
      const mcpBindingIds = [...new Set(mcpToolSpecs.map((s) => s.bindingId))];

      const toolIntegrationContext = await this.workspaceIntegrationsService.getToolIntegrationContext(ws);

      const capRow = srow['capabilities'] as
        | { tools?: string[]; customToolDefinitionIds?: string[] }
        | undefined;
      const customIds = Array.isArray(capRow?.customToolDefinitionIds)
        ? capRow.customToolDefinitionIds.filter((x): x is string => typeof x === 'string')
        : [];
      const customRows = await this.workspaceToolDefinitionRepo.listByIds(ws, customIds);
      const customToolDefinitions: IWorkspaceCustomToolDefinition[] = customRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        kind: r.kind,
        jsonSchema: r.jsonSchema,
        config: r.config,
      }));

      const config = composeExecutableAgentConfig({
        agentId: specialistAgentId,
        workspaceId: ws,
        systemInstruction,
        tools: (capRow?.tools ?? []) as string[],
        mcpBindingIds,
        knowledgeSourceIds,
        mcpToolSpecs,
        toolIntegrationContext,
        customToolDefinitions,
        teamContext: { teamId: teamRow.id, teamName: teamRow.name },
      });
      await this.agentRuntime.compile(config);
      const openaiApiKey = await this.workspaceIntegrationsService.resolveOpenAiApiKey(ws);

      const ext = invocation.coordinatorExternalContext;
      const agentSec = srow['security'] as { accessLevel?: string } | undefined;
      const levelFromAgent = agentSec?.accessLevel;
      const requestedAccessLevel =
        ext.requestedAccessLevel ??
        (levelFromAgent === 'read' || levelFromAgent === 'write' || levelFromAgent === 'restricted'
          ? levelFromAgent
          : undefined);

      const correlationId =
        typeof invocation.metadata?.correlationId === 'string'
          ? invocation.metadata.correlationId
          : undefined;

      const r = await this.agentRuntime.runStep(config, {
        message: runtimeMessage,
        ...(openaiApiKey ? { openaiApiKey } : {}),
        ...(requestedAccessLevel ? { requestedAccessLevel } : {}),
        ...(correlationId ? { correlationId } : {}),
      });
      specialistResults.push({ specialistAgentId, summary: r.finalOutput });
      specialistSidecarEvents.push({
        type: 'specialistFinished',
        agentId: specialistAgentId,
        phase: 'runStep',
        detail: truncateActivity(r.finalOutput),
      });
      emitProgress({
        agentId: specialistAgentId,
        status: 'idle',
        phase: 'specialist',
        detail: truncateActivity(r.finalOutput),
      });
      return r.finalOutput;
    };

    const sdkTools = this.specialistRegistry.buildOpenAiTools({ specialists, executeSpecialist });
    const openaiApiKey = await this.workspaceIntegrationsService.resolveOpenAiApiKey(ws);
    const userMessage = formatCoordinatorUserMessage(invocation);
    const crow = coordinator as Record<string, unknown>;
    const baseCoordinatorSystem = (crow['systemInstruction'] as string | undefined)?.trim();
    const coordinatorSystemInstruction =
      (baseCoordinatorSystem ? `${baseCoordinatorSystem}${COORDINATOR_SPECIALIST_TOOL_GUIDANCE}` : undefined) ??
      `Voce e o coordenador do time de agentes.${COORDINATOR_SPECIALIST_TOOL_GUIDANCE}`;

    const streamText = Boolean(options?.streamCoordinatorText && options?.onCoordinatorTextDelta);
    const timeline: ITeamExecutionEvent[] = [
      { type: 'coordinatorStarted', agentId: teamRow.coordinatorId, phase: 'invoke' },
    ];
    emitProgress({
      agentId: teamRow.coordinatorId,
      status: 'busy',
      phase: 'coordinator',
      detail: 'A executar coordenador',
    });

    const result = await this.agentRuntime.runCoordinatorTurn({
      coordinatorAgentId: teamRow.coordinatorId,
      workspaceId: ws,
      systemInstruction: coordinatorSystemInstruction,
      userMessage,
      ...(openaiApiKey ? { openaiApiKey } : {}),
      sdkTools,
      ...(streamText && options?.onCoordinatorTextDelta
        ? { onAssistantTextDelta: options.onCoordinatorTextDelta }
        : {}),
    });

    emitProgress({
      agentId: teamRow.coordinatorId,
      status: 'idle',
      phase: 'coordinator',
    });

    const coordinatorMapped = result.events.map((e) => mapRuntimeEventToTeamEvent(e, specialistIds));
    timeline.push(...coordinatorMapped, ...specialistSidecarEvents, {
      type: 'coordinatorFinished',
      agentId: teamRow.coordinatorId,
      phase: 'done',
    });

    return {
      runId,
      teamId: teamRow.id,
      coordinatorAgentId: teamRow.coordinatorId,
      externalResponse: composeExternalResponseFromModelText(result.finalOutput),
      specialistResults,
      events: timeline,
    };
  }
}
