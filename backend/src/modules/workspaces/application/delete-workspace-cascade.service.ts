import { Types } from 'mongoose';
import type { IAppDeps } from '../../../config/container.js';
import { AgentMcpBindingModel } from '../../agents/infra/agent-mcp-binding.model.js';
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
import { TeamDebugSessionModel } from '../../team-runtime/infra/team-debug-session.model.js';
import { WorkspaceToolDefinitionModel } from '../../tool-definitions/infra/workspace-tool-definition.model.js';

type CleanupModel = { model: { deleteMany: (query: Record<string, unknown>) => Promise<{ deletedCount?: number }> } };

const MODELS_WITH_WORKSPACE_ID: CleanupModel[] = [
  { model: AgentMcpBindingModel },
  { model: AgentOverlapReviewModel },
  { model: AgentPlanModel },
  { model: AuditLogModel },
  { model: BusinessToolAuditModel },
  { model: ChannelModel },
  { model: AnamnesisModel },
  { model: EvolutionNoteModel },
  { model: CareSubjectModel },
  { model: PartyModel },
  { model: PayableModel },
  { model: ReceivableModel },
  { model: GovernanceAuditEventModel },
  { model: KnowledgeSourceModel },
  { model: McpConnectionModel },
  { model: EncounterModel },
  { model: PackageSaleModel },
  { model: ReminderModel },
  { model: RunEventModel },
  { model: RunStepModel },
  { model: RunModel },
  { model: AppointmentModel },
  { model: AvailabilitySlotModel },
  { model: ApiKeyModel },
  { model: ServiceCatalogItemModel },
  { model: ServiceOrderModel },
  { model: TeamPlanModel },
  { model: TeamDebugSessionModel },
  { model: TemplateModel },
  { model: WorkspaceToolDefinitionModel },
];

export async function deleteWorkspaceCascade(
  deps: IAppDeps,
  workspaceId: string,
): Promise<{ ok: boolean }> {
  const oid = new Types.ObjectId(workspaceId);

  await Promise.all(MODELS_WITH_WORKSPACE_ID.map(({ model }) => model.deleteMany({ workspaceId: oid })));

  await Promise.all([
    deps.teamRepo.deleteByWorkspaceId(workspaceId),
    deps.agentRepo.deleteByWorkspaceId(workspaceId),
    deps.memberRepo.deleteByWorkspaceId(workspaceId),
    deps.inviteRepo.deleteByWorkspaceId(workspaceId),
  ]);

  await deps.userRepo.removeWorkspaceIdFromAllUsers(workspaceId);
  await deps.workspaceRepo.deleteWorkspace(workspaceId);

  return { ok: true };
}
