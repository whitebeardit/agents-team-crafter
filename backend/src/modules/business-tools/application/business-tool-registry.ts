import { getBusinessActionPreset } from './business-action-presets.js';
import { getBusinessActionGuardProfile } from './business-action-guard-profiles.js';
import {
  classifyBusinessActionOperation,
  type TBusinessActionOperationType,
} from './business-action-operation-policy.js';

/**
 * Registry of internal business actions keyed by stable `actionId` (e.g. `business.ping`, `crm_create_party`).
 */
export type TBusinessActionContext = {
  workspaceId: string;
  input: unknown;
  correlationId?: string;
};

export type TBusinessActionHandler = (ctx: TBusinessActionContext) => Promise<unknown>;

/** Item do catálogo exposto à UI (GET /business-actions/catalog). */
export interface IBusinessActionCatalogItem {
  actionId: string;
  title: string;
  description: string;
  operationType: TBusinessActionOperationType;
  packId?: string;
  inputSchema?: Record<string, unknown>;
  requiredFieldLabels?: string[];
  examples?: Array<Record<string, unknown>>;
  slotFillingPromptHint?: string;
  capabilityKind?: 'business_action' | 'primitive_like' | 'gold_gate';
  uiExposureMode?: 'primary' | 'advanced' | 'hidden';
  domainScope?: string;
  dependsOnCatalogTools?: string[];
  dependsOnActionIds?: string[];
  guardProfileId?: string;
  guardProfileSummary?: {
    title: string;
    description: string;
    rulesSummary: string[];
  };
}

export class BusinessToolRegistry {
  private readonly handlers = new Map<string, TBusinessActionHandler>();

  register(actionId: string, handler: TBusinessActionHandler): void {
    const id = actionId.trim();
    if (!id) throw new Error('actionId required');
    this.handlers.set(id, handler);
  }

  get(actionId: string): TBusinessActionHandler | undefined {
    return this.handlers.get(actionId.trim());
  }

  has(actionId: string): boolean {
    return this.handlers.has(actionId.trim());
  }

  /**
   * Todas as ações registadas no processo, com metadados PT-BR quando existirem em `business-action-presets.ts`.
   */
  listCatalog(): IBusinessActionCatalogItem[] {
    const items: IBusinessActionCatalogItem[] = [];
    for (const actionId of this.handlers.keys()) {
      const preset = getBusinessActionPreset(actionId);
      items.push({
        actionId,
        title: preset?.title ?? actionId,
        description: preset?.description ?? '',
        operationType: classifyBusinessActionOperation(actionId),
        packId: preset?.packId,
        inputSchema: preset?.inputSchema,
        requiredFieldLabels: preset?.requiredFieldLabels,
        examples: preset?.examples,
        slotFillingPromptHint: preset?.slotFillingPromptHint,
        capabilityKind: preset?.capabilityKind,
        uiExposureMode: preset?.uiExposureMode,
        domainScope: preset?.domainScope,
        dependsOnCatalogTools: preset?.dependsOnCatalogTools,
        dependsOnActionIds: preset?.dependsOnActionIds,
        guardProfileId: preset?.guardProfileId,
        guardProfileSummary: preset?.guardProfileId
          ? (() => {
              const gp = getBusinessActionGuardProfile(preset.guardProfileId);
              if (!gp) return undefined;
              return {
                title: gp.title,
                description: gp.description,
                rulesSummary: gp.rulesSummary,
              };
            })()
          : undefined,
      });
    }
    items.sort((a, b) => a.title.localeCompare(b.title, 'pt'));
    return items;
  }
}
