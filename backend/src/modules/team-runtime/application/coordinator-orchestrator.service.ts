import { randomUUID } from 'node:crypto';
import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import type { TeamRepository } from '../../teams/infra/team.repository.js';
import type { AgentMcpBindingRepository } from '../../agents/infra/agent-mcp-binding.repository.js';
import type { McpConnectionRepository } from '../../mcps/infra/mcp-connection.repository.js';
import type { KnowledgeSourceRepository } from '../../knowledge/infra/knowledge-source.repository.js';
import type { IAgentRuntimeProvider, IWorkspaceCustomToolDefinition } from '../../runtime/ports/agent-runtime.provider.js';
import type { WorkspaceToolDefinitionRepository } from '../../tool-definitions/infra/workspace-tool-definition.repository.js';
import { composeExecutableAgentConfig } from '../../runtime/application/compose-executable-config.js';
import { buildSpecialistSystemInstruction } from '../../runtime/application/build-specialist-system-instruction.js';
import { buildKnowledgeAppendixForAgent } from '../../runtime/application/build-knowledge-appendix.js';
import { loadMcpToolSpecsForAgent } from '../../runtime/application/load-mcp-tool-specs.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ISpecialistResult } from '../domain/specialist-result.js';
import type { ITeamExecutionResult } from '../domain/team-execution-result.js';
import {
  assertSpecialistAgentRow,
  assertTeamCoordinatorBinding,
  listSpecialistIds,
} from '../domain/team-runtime-invariants.js';
import { assertInvocationMatchesTeam } from './team-runtime-guards.service.js';
import { composeExternalResponseFromModelText } from './response-composer.service.js';
import { formatCoordinatorUserMessage } from './format-coordinator-user-message.js';
import { SpecialistRegistry } from '../infra/registries/specialist-registry.js';
import type { WorkspaceIntegrationsService } from '../../settings/application/workspace-integrations.service.js';

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

  async execute(invocation: ITeamInvocation): Promise<ITeamExecutionResult> {
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

    const executeSpecialist = async (specialistAgentId: string, instruction: string) => {
      const spec = await this.agentRepo.findById(ws, specialistAgentId);
      if (!spec) return 'Especialista nao encontrado.';
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
        message: instruction,
        ...(openaiApiKey ? { openaiApiKey } : {}),
        ...(requestedAccessLevel ? { requestedAccessLevel } : {}),
        ...(correlationId ? { correlationId } : {}),
      });
      specialistResults.push({ specialistAgentId, summary: r.finalOutput });
      return r.finalOutput;
    };

    const sdkTools = this.specialistRegistry.buildOpenAiTools({ specialists, executeSpecialist });
    const openaiApiKey = await this.workspaceIntegrationsService.resolveOpenAiApiKey(ws);
    const userMessage = formatCoordinatorUserMessage(invocation);
    const crow = coordinator as Record<string, unknown>;

    const result = await this.agentRuntime.runCoordinatorTurn({
      coordinatorAgentId: teamRow.coordinatorId,
      workspaceId: ws,
      systemInstruction: (crow['systemInstruction'] as string | undefined) ?? undefined,
      userMessage,
      ...(openaiApiKey ? { openaiApiKey } : {}),
      sdkTools,
    });

    const runId = randomUUID();
    return {
      runId,
      teamId: teamRow.id,
      coordinatorAgentId: teamRow.coordinatorId,
      externalResponse: composeExternalResponseFromModelText(result.finalOutput),
      specialistResults,
      events: result.events.map((e) => {
        if (e.type === 'taskType') return { type: e.type, value: e.value };
        return { type: e.type, tool: e.tool, status: e.status, errorCode: e.errorCode };
      }),
    };
  }
}
