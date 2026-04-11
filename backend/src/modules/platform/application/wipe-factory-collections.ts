import type { Model } from 'mongoose';
import { AgentMcpBindingModel } from '../../agents/infra/agent-mcp-binding.model.js';
import { AgentModel } from '../../agents/infra/agent.model.js';
import { AgentOverlapReviewModel } from '../../agent-governance/infra/agent-overlap-review.model.js';
import { AgentPlanModel } from '../../agent-planning/infra/agent-plan.model.js';
import { AuditLogModel } from '../../audit/infra/audit-log.model.js';
import { BusinessToolAuditModel } from '../../business-tools/infra/business-tool-audit.model.js';
import { ChannelModel } from '../../channels/infra/channel.model.js';
import { AnamnesisModel } from '../../clinical/infra/anamnesis.model.js';
import { EvolutionNoteModel } from '../../clinical/infra/evolution-note.model.js';
import { CareSubjectModel } from '../../care/infra/care-subject.model.js';
import { PartyModel } from '../../crm/infra/party.model.js';
import { PayableModel } from '../../finance/infra/payable.model.js';
import { ReceivableModel } from '../../finance/infra/receivable.model.js';
import { GovernanceAuditEventModel } from '../../governance/infra/governance-audit-event.model.js';
import { TeamGraphModel } from '../../graphs/infra/team-graph.model.js';
import { KnowledgeSourceModel } from '../../knowledge/infra/knowledge-source.model.js';
import { McpConnectionModel } from '../../mcps/infra/mcp-connection.model.js';
import { EncounterModel } from '../../packages-encounters/infra/encounter.model.js';
import { PackageSaleModel } from '../../packages-encounters/infra/package-sale.model.js';
import { ReminderModel } from '../../reminders/infra/reminder.model.js';
import { RunEventModel } from '../../runs/infra/run-event.model.js';
import { RunStepModel } from '../../runs/infra/run-step.model.js';
import { RunModel } from '../../runs/infra/run.model.js';
import { AppointmentModel } from '../../scheduling/infra/appointment.model.js';
import { AvailabilitySlotModel } from '../../scheduling/infra/availability-slot.model.js';
import { ApiKeyModel } from '../../settings/infra/api-key.model.js';
import { ServiceCatalogItemModel } from '../../services-sales/infra/service-catalog-item.model.js';
import { ServiceOrderModel } from '../../services-sales/infra/service-order.model.js';
import { TeamPlanModel } from '../../team-planning/infra/team-plan.model.js';
import { TemplateModel } from '../../templates/infra/template.model.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import { WorkspaceToolDefinitionModel } from '../../tool-definitions/infra/workspace-tool-definition.model.js';
import { UserModel } from '../../users/infra/user.model.js';
import { InviteModel } from '../../workspaces/infra/invite.model.js';
import { WorkspaceMemberModel } from '../../workspaces/infra/workspace-member.model.js';
import { WorkspaceModel } from '../../workspaces/infra/workspace.model.js';

type NamedModel = { collectionName: string; model: Model<unknown> };

/** Todas as coleções de domínio da aplicação (paridade com `scripts/seed-demo.ts` + módulos posteriores). */
const NAMED_MODELS: NamedModel[] = [
  { collectionName: 'AgentMcpBinding', model: AgentMcpBindingModel },
  { collectionName: 'Agent', model: AgentModel },
  { collectionName: 'AgentOverlapReview', model: AgentOverlapReviewModel },
  { collectionName: 'AgentPlan', model: AgentPlanModel },
  { collectionName: 'AuditLog', model: AuditLogModel },
  { collectionName: 'BusinessToolAudit', model: BusinessToolAuditModel },
  { collectionName: 'Channel', model: ChannelModel },
  { collectionName: 'Anamnesis', model: AnamnesisModel },
  { collectionName: 'EvolutionNote', model: EvolutionNoteModel },
  { collectionName: 'CareSubject', model: CareSubjectModel },
  { collectionName: 'Party', model: PartyModel },
  { collectionName: 'Payable', model: PayableModel },
  { collectionName: 'Receivable', model: ReceivableModel },
  { collectionName: 'GovernanceAuditEvent', model: GovernanceAuditEventModel },
  { collectionName: 'TeamGraph', model: TeamGraphModel },
  { collectionName: 'KnowledgeSource', model: KnowledgeSourceModel },
  { collectionName: 'McpConnection', model: McpConnectionModel },
  { collectionName: 'Encounter', model: EncounterModel },
  { collectionName: 'PackageSale', model: PackageSaleModel },
  { collectionName: 'Reminder', model: ReminderModel },
  { collectionName: 'RunEvent', model: RunEventModel },
  { collectionName: 'RunStep', model: RunStepModel },
  { collectionName: 'Run', model: RunModel },
  { collectionName: 'Appointment', model: AppointmentModel },
  { collectionName: 'AvailabilitySlot', model: AvailabilitySlotModel },
  { collectionName: 'ApiKey', model: ApiKeyModel },
  { collectionName: 'ServiceCatalogItem', model: ServiceCatalogItemModel },
  { collectionName: 'ServiceOrder', model: ServiceOrderModel },
  { collectionName: 'TeamPlan', model: TeamPlanModel },
  { collectionName: 'Template', model: TemplateModel },
  { collectionName: 'Team', model: TeamModel },
  { collectionName: 'WorkspaceToolDefinition', model: WorkspaceToolDefinitionModel },
  { collectionName: 'Invite', model: InviteModel },
  { collectionName: 'WorkspaceMember', model: WorkspaceMemberModel },
  { collectionName: 'Workspace', model: WorkspaceModel },
  { collectionName: 'User', model: UserModel },
];

/**
 * Apaga todos os documentos das coleções de negócio (instalação vazia).
 * Semântica: equivalente ao wipe inicial de `seed-demo.ts` antes do re-seed.
 */
export async function wipeAllApplicationCollections(): Promise<{
  byCollection: Record<string, number>;
  totalDeleted: number;
}> {
  const byCollection: Record<string, number> = {};
  let totalDeleted = 0;
  await Promise.all(
    NAMED_MODELS.map(async ({ collectionName, model }) => {
      const res = await model.deleteMany({});
      const n = res.deletedCount ?? 0;
      byCollection[collectionName] = n;
      totalDeleted += n;
    }),
  );
  return { byCollection, totalDeleted };
}
