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
import { WorkspaceToolDefinitionRepository } from '../modules/tool-definitions/infra/workspace-tool-definition.repository.js';
import { ChannelSecretsService } from '../modules/channels/application/channel-secrets.service.js';
import { WorkspaceIntegrationsService } from '../modules/settings/application/workspace-integrations.service.js';
import { buildAuthenticate, buildRequirePlatformAdmin, buildRequireTenant } from '../app/plugins/hooks.js';
import type { FastifyRequest } from 'fastify';
import type { preHandlerHookHandler } from 'fastify';

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
  agentRuntime: OpenAIAgentsRuntimeProvider;
  specialistRegistry: SpecialistRegistry;
  coordinatorOrchestrator: CoordinatorOrchestratorService;
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
  );
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
    agentRuntime,
    specialistRegistry,
    coordinatorOrchestrator,
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
