import type { IEnv } from './env.js';
import { createJwtService } from '../shared/utils/jwt-service.js';
import { UserRepository } from '../modules/users/infra/user.repository.js';
import { WorkspaceRepository } from '../modules/workspaces/infra/workspace.repository.js';
import { MemberRepository } from '../modules/workspaces/infra/member.repository.js';
import { InviteRepository } from '../modules/workspaces/infra/invite.repository.js';
import { AgentRepository } from '../modules/agents/infra/agent.repository.js';
import { TeamRepository } from '../modules/teams/infra/team.repository.js';
import { ChannelRepository } from '../modules/channels/infra/channel.repository.js';
import { TeamGraphRepository } from '../modules/graphs/infra/team-graph.repository.js';
import { TemplateRepository } from '../modules/templates/infra/template.repository.js';
import { McpConnectionRepository } from '../modules/mcps/infra/mcp-connection.repository.js';
import { AgentMcpBindingRepository } from '../modules/agents/infra/agent-mcp-binding.repository.js';
import { KnowledgeSourceRepository } from '../modules/knowledge/infra/knowledge-source.repository.js';
import { DashboardRepository } from '../modules/dashboard/infra/dashboard.repository.js';
import { ApiKeyRepository } from '../modules/settings/infra/api-key.repository.js';
import { SettingsRepository } from '../modules/settings/infra/settings.repository.js';
import { AuditLogRepository } from '../modules/audit/infra/audit-log.repository.js';
import { OpenAIAgentsRuntimeProvider } from '../modules/runtime/infra/openai-agents-runtime.provider.js';
import { SpecialistRegistry } from '../modules/team-runtime/infra/registries/specialist-registry.js';
import { CoordinatorOrchestratorService } from '../modules/team-runtime/application/coordinator-orchestrator.service.js';
import { TeamDebugSessionRepository } from '../modules/team-runtime/infra/team-debug-session.repository.js';
import {
  createTeamLiveBroadcaster,
  type TeamLiveBroadcaster,
} from '../modules/teams/infrastructure/team-live-broadcaster.js';
import { WorkspaceToolDefinitionRepository } from '../modules/tool-definitions/infra/workspace-tool-definition.repository.js';
import { BusinessToolRegistry } from '../modules/business-tools/application/business-tool-registry.js';
import { BusinessToolAuditRepository } from '../modules/business-tools/infra/business-tool-audit.repository.js';
import { BusinessToolRuntime } from '../modules/business-tools/application/business-tool-runtime.js';
import { registerCoreBusinessActions } from '../modules/business-tools/application/register-core-business-actions.js';
import { registerAllBusinessPacks } from '../modules/business-tools/application/register-all-business-packs.js';
import { PartyRepository } from '../modules/crm/infra/party.repository.js';
import { CareSubjectRepository } from '../modules/care/infra/care-subject.repository.js';
import { ServiceCatalogRepository } from '../modules/services-sales/infra/service-catalog.repository.js';
import { ServiceOrderRepository } from '../modules/services-sales/infra/service-order.repository.js';
import { PackageSaleRepository } from '../modules/packages-encounters/infra/package-sale.repository.js';
import { EncounterRepository } from '../modules/packages-encounters/infra/encounter.repository.js';
import { FinanceRepository } from '../modules/finance/infra/finance.repository.js';
import { ReminderRepository } from '../modules/reminders/infra/reminder.repository.js';
import { ChannelSecretsService } from '../modules/channels/application/channel-secrets.service.js';
import { WorkspaceIntegrationsService } from '../modules/settings/application/workspace-integrations.service.js';
import { AgentOverlapReviewRepository } from '../modules/agent-governance/infra/agent-overlap-review.repository.js';
import { DomainGuardService } from '../modules/agent-governance/application/domain-guard.service.js';
import { RunRepository } from '../modules/runs/infra/run.repository.js';
import { RunRecorderService } from '../modules/runs/application/run-recorder.service.js';
import { GovernanceAuditEventRepository } from '../modules/governance/infra/governance-audit-event.repository.js';
import { AppointmentRepository } from '../modules/scheduling/infra/appointment.repository.js';
import { AvailabilitySlotRepository } from '../modules/scheduling/infra/availability-slot.repository.js';
import { buildAuthenticate, buildRequirePlatformAdmin, buildRequireTenant } from '../app/plugins/hooks.js';
import type { FastifyRequest } from 'fastify';
import type { preHandlerHookHandler } from 'fastify';
import { Redis } from 'ioredis';
import { createRedisAppClient } from '../infrastructure/redis-app.js';

export interface IAppDeps {
  env: IEnv;
  jwt: ReturnType<typeof createJwtService>;
  authenticate: preHandlerHookHandler;
  requirePlatformAdmin: preHandlerHookHandler;
  requireTenant: preHandlerHookHandler;
  userRepo: UserRepository;
  workspaceRepo: WorkspaceRepository;
  memberRepo: MemberRepository;
  inviteRepo: InviteRepository;
  agentRepo: AgentRepository;
  teamRepo: TeamRepository;
  channelRepo: ChannelRepository;
  channelSecretsService: ChannelSecretsService;
  teamGraphRepo: TeamGraphRepository;
  templateRepo: TemplateRepository;
  mcpRepo: McpConnectionRepository;
  agentMcpBindingRepo: AgentMcpBindingRepository;
  knowledgeSourceRepo: KnowledgeSourceRepository;
  dashboardRepo: DashboardRepository;
  apiKeyRepo: ApiKeyRepository;
  settingsRepo: SettingsRepository;
  workspaceIntegrationsService: WorkspaceIntegrationsService;
  auditLogRepo: AuditLogRepository;
  workspaceToolDefinitionRepo: WorkspaceToolDefinitionRepository;
  businessToolRegistry: BusinessToolRegistry;
  businessToolRuntime: BusinessToolRuntime;
  agentOverlapReviewRepo: AgentOverlapReviewRepository;
  domainGuardService: DomainGuardService;
  runRepo: RunRepository;
  runRecorderService: RunRecorderService;
  governanceAuditRepo: GovernanceAuditEventRepository;
  agentRuntime: OpenAIAgentsRuntimeProvider;
  specialistRegistry: SpecialistRegistry;
  coordinatorOrchestrator: CoordinatorOrchestratorService;
  teamLiveBroadcaster: TeamLiveBroadcaster;
  /**
   * Cliente Redis opcional (único por processo): team live pub/sub + rate limit de governança.
   * Criado em `createRedisAppClient` quando `REDIS_URL` está definido.
   */
  redis: Redis | null;
  partyRepo: PartyRepository;
  teamDebugSessionRepo: TeamDebugSessionRepository;
}

export function createDeps(env: IEnv): IAppDeps {
  const jwt = createJwtService(env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const platformAdminEmails = env.platformAdminEmails ?? new Set<string>();
  const userRepo = new UserRepository(platformAdminEmails);
  const workspaceRepo = new WorkspaceRepository();
  const memberRepo = new MemberRepository();
  const inviteRepo = new InviteRepository();
  const agentRepo = new AgentRepository();
  const teamRepo = new TeamRepository();
  const channelRepo = new ChannelRepository();
  const channelSecretsService = new ChannelSecretsService(env);
  const teamGraphRepo = new TeamGraphRepository();
  const templateRepo = new TemplateRepository();
  const mcpRepo = new McpConnectionRepository();
  const agentMcpBindingRepo = new AgentMcpBindingRepository(mcpRepo);
  const knowledgeSourceRepo = new KnowledgeSourceRepository();
  const dashboardRepo = new DashboardRepository();
  const apiKeyRepo = new ApiKeyRepository();
  const settingsRepo = new SettingsRepository();
  const workspaceIntegrationsService = new WorkspaceIntegrationsService(env, workspaceRepo);
  const auditLogRepo = new AuditLogRepository();
  const workspaceToolDefinitionRepo = new WorkspaceToolDefinitionRepository();
  const businessToolRegistry = new BusinessToolRegistry();
  registerCoreBusinessActions(businessToolRegistry);
  const partyRepo = new PartyRepository();
  const careSubjectRepo = new CareSubjectRepository();
  const serviceCatalogRepo = new ServiceCatalogRepository();
  const serviceOrderRepo = new ServiceOrderRepository();
  const packageSaleRepo = new PackageSaleRepository();
  const encounterRepo = new EncounterRepository();
  const financeRepo = new FinanceRepository();
  const reminderRepo = new ReminderRepository();
  const appointmentRepo = new AppointmentRepository();
  const availabilitySlotRepo = new AvailabilitySlotRepository();
  registerAllBusinessPacks({
    registry: businessToolRegistry,
    partyRepo,
    careSubjectRepo,
    serviceCatalogRepo,
    serviceOrderRepo,
    packageSaleRepo,
    encounterRepo,
    financeRepo,
    reminderRepo,
    appointmentRepo,
    availabilitySlotRepo,
  });
  const businessToolAuditRepo = new BusinessToolAuditRepository();
  const businessToolRuntime = new BusinessToolRuntime(businessToolRegistry, businessToolAuditRepo);
  const agentOverlapReviewRepo = new AgentOverlapReviewRepository();
  const domainGuardService = new DomainGuardService(agentRepo);
  const runRepo = new RunRepository();
  const runRecorderService = new RunRecorderService(runRepo);
  const governanceAuditRepo = new GovernanceAuditEventRepository();
  const agentRuntime = new OpenAIAgentsRuntimeProvider();
  const specialistRegistry = new SpecialistRegistry();
  const coordinatorOrchestrator = new CoordinatorOrchestratorService(
    agentRepo,
    teamRepo,
    agentRuntime,
    specialistRegistry,
    workspaceIntegrationsService,
    agentMcpBindingRepo,
    mcpRepo,
    knowledgeSourceRepo,
    workspaceToolDefinitionRepo,
    businessToolRuntime,
  );
  const redis = createRedisAppClient(env.REDIS_URL);
  const teamLiveBroadcaster = createTeamLiveBroadcaster(redis);
  const teamDebugSessionRepo = new TeamDebugSessionRepository();
  const authenticate = buildAuthenticate(env.JWT_SECRET, { platformAdminEmails });
  const requirePlatformAdmin = buildRequirePlatformAdmin();
  const requireTenant = buildRequireTenant(memberRepo);
  return {
    env,
    jwt,
    authenticate,
    requirePlatformAdmin,
    requireTenant,
    userRepo,
    workspaceRepo,
    memberRepo,
    inviteRepo,
    agentRepo,
    teamRepo,
    channelRepo,
    channelSecretsService,
    teamGraphRepo,
    templateRepo,
    mcpRepo,
    agentMcpBindingRepo,
    knowledgeSourceRepo,
    dashboardRepo,
    apiKeyRepo,
    settingsRepo,
    workspaceIntegrationsService,
    auditLogRepo,
    workspaceToolDefinitionRepo,
    businessToolRegistry,
    businessToolRuntime,
    agentOverlapReviewRepo,
    domainGuardService,
    runRepo,
    runRecorderService,
    governanceAuditRepo,
    agentRuntime,
    specialistRegistry,
    coordinatorOrchestrator,
    teamLiveBroadcaster,
    redis,
    partyRepo,
    teamDebugSessionRepo,
  };
}

export function requireRole(...allowed: Array<'owner' | 'admin' | 'member'>): preHandlerHookHandler {
  return async (req: FastifyRequest) => {
    const role = req.membershipRole;
    if (!role || !allowed.includes(role)) {
      const { AppError } = await import('../shared/errors/app-error.js');
      throw new AppError('FORBIDDEN', 'Sem permissao para esta operacao', 403);
    }
  };
}

export function requireAdmin(opts?: { allowPlatformAdmin?: boolean }): preHandlerHookHandler {
  return async (req: FastifyRequest) => {
    if (opts?.allowPlatformAdmin === true && req.user?.isPlatformAdmin) {
      return;
    }
    const role = req.membershipRole;
    if (!role || !['owner', 'admin'].includes(role)) {
      const { AppError } = await import('../shared/errors/app-error.js');
      throw new AppError('FORBIDDEN', 'Sem permissao para esta operacao', 403);
    }
  };
}
