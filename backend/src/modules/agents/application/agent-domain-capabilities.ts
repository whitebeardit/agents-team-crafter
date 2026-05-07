import { ensureInternalActionDefinitions } from '../../team-planning/application/ensure-planner-tool-definitions.js';
import { resolveDomainCapabilitySelection } from '../../business-tools/application/domain-capability-registry.js';
import { normalizeAgentCapabilities } from './agent-capabilities.js';
import type { IAgentRepository } from '../domain/ports/agent-repository.port.js';
import type { WorkspaceToolDefinitionRepository } from '../../tool-definitions/infra/workspace-tool-definition.repository.js';

export interface IApplyAgentDomainCapabilitiesDeps {
  agentRepo: IAgentRepository;
  workspaceToolDefinitionRepo: WorkspaceToolDefinitionRepository;
  hasBusinessAction: (actionId: string) => boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getInternalActionId(definition: Record<string, unknown>): string | undefined {
  if (definition['kind'] !== 'internal_action') return undefined;
  const config = asRecord(definition['config']);
  return typeof config['actionId'] === 'string' ? config['actionId'] : undefined;
}

export async function applyAgentDomainCapabilities(
  deps: IApplyAgentDomainCapabilitiesDeps,
  workspaceId: string,
  agentId: string,
  domainIds: readonly string[],
) {
  const agent = await deps.agentRepo.findById(workspaceId, agentId);
  if (!agent) return null;

  const resolution = resolveDomainCapabilitySelection(domainIds);
  const actionIds = resolution.actionIds.filter((actionId) => deps.hasBusinessAction(actionId));
  const allDefinitions = await deps.workspaceToolDefinitionRepo.list(workspaceId);
  const byActionId = new Map<string, { id: string; enabled?: boolean }>();
  for (const definition of allDefinitions) {
    const actionId = getInternalActionId(definition);
    if (actionId && !byActionId.has(actionId)) byActionId.set(actionId, { id: definition.id, enabled: definition.enabled });
  }

  const missingActionIds = actionIds.filter((actionId) => !byActionId.has(actionId));
  const createdIds = await ensureInternalActionDefinitions(workspaceId, missingActionIds, deps.workspaceToolDefinitionRepo);
  missingActionIds.forEach((actionId, index) => {
    const id = createdIds[index];
    if (!id) return;
    byActionId.set(actionId, { id, enabled: true });
  });

  const reactivatedToolDefinitionIds: string[] = [];
  for (const actionId of actionIds) {
    const definition = byActionId.get(actionId);
    if (!definition || definition.enabled !== false) continue;
    const updated = await deps.workspaceToolDefinitionRepo.update(workspaceId, definition.id, { enabled: true });
    if (updated) {
      reactivatedToolDefinitionIds.push(updated.id);
      byActionId.set(actionId, { id: updated.id, enabled: updated.enabled });
    }
  }

  const cap = asRecord((agent as Record<string, unknown>)['capabilities']);
  const previous = normalizeAgentCapabilities(cap);
  const customToolDefinitionIds = [
    ...previous.customToolDefinitionIds,
    ...actionIds
      .map((actionId) => byActionId.get(actionId)?.id)
      .filter((value): value is string => typeof value === 'string'),
  ];
  const tools = [...previous.tools, ...resolution.catalogTools];
  const capabilities = normalizeAgentCapabilities({
    ...previous,
    tools,
    customToolDefinitionIds,
  });

  await deps.agentRepo.update(workspaceId, agentId, { capabilities });
  return {
    agentId,
    capabilities,
    resolution: {
      ...resolution,
      actionIds,
      unavailableActionIds: resolution.actionIds.filter((actionId) => !deps.hasBusinessAction(actionId)),
    },
    createdToolDefinitionIds: createdIds,
    reactivatedToolDefinitionIds,
  };
}

