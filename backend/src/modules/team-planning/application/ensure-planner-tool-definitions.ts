import type { WorkspaceToolDefinitionRepository } from '../../tool-definitions/infra/workspace-tool-definition.repository.js';
import { getBusinessActionPreset } from '../../business-tools/application/business-action-presets.js';
import { actionIdToToolSlug } from './planner-pack-presets.js';

/**
 * Garante uma `WorkspaceToolDefinition` por actionId (kind internal_action), reutilizando slug estável.
 */
export async function ensureInternalActionDefinitions(
  workspaceId: string,
  actionIds: string[],
  repo: WorkspaceToolDefinitionRepository,
): Promise<string[]> {
  const definitionIds: string[] = [];
  const seen = new Set<string>();

  for (const raw of actionIds) {
    const actionId = raw.trim();
    if (!actionId || seen.has(actionId)) continue;
    seen.add(actionId);

    const slug = actionIdToToolSlug(actionId);
    const existing = await repo.findBySlug(workspaceId, slug);
    if (existing) {
      definitionIds.push(existing.id);
      continue;
    }

    try {
      const preset = getBusinessActionPreset(actionId);
      const displayName = preset?.title?.trim() ? preset.title.trim() : `Negócio: ${actionId}`;
      const created = await repo.create(workspaceId, {
        name: displayName,
        slug,
        kind: 'internal_action',
        jsonSchema: {
          type: 'object',
          additionalProperties: true,
          description: `Parâmetros para a ação interna ${actionId}`,
        },
        config: { actionId },
      });
      definitionIds.push(created.id);
    } catch (e: unknown) {
      const dup =
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: number }).code === 11000;
      if (dup) {
        const again = await repo.findBySlug(workspaceId, slug);
        if (again) definitionIds.push(again.id);
        else throw e;
      } else {
        throw e;
      }
    }
  }

  return definitionIds;
}
