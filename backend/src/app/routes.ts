import type { FastifyInstance } from 'fastify';
import type { IEnv } from '../config/env.js';
import { createDeps, type IAppDeps } from '../config/container.js';
import { registerAuthRoutes } from '../modules/auth/interfaces/auth.routes.js';
import { registerWorkspaceRoutes } from '../modules/workspaces/interfaces/workspace.routes.js';
import { registerAgentRoutes } from '../modules/agents/interfaces/agent.routes.js';
import { registerAgentMcpBindingRoutes } from '../modules/agents/interfaces/agent-mcp-binding.routes.js';
import { registerMcpRoutes } from '../modules/mcps/interfaces/mcp.routes.js';
import { registerTeamRoutes } from '../modules/teams/interfaces/team.routes.js';
import {
  registerTemplateRoutes,
  registerPlatformTemplateRoutes,
} from '../modules/templates/interfaces/template.routes.js';
import { registerChannelRoutes } from '../modules/channels/interfaces/channel.routes.js';
import { registerKnowledgeRoutes } from '../modules/knowledge/interfaces/knowledge.routes.js';
import { registerDashboardRoutes } from '../modules/dashboard/interfaces/dashboard.routes.js';
import { registerSettingsRoutes } from '../modules/settings/interfaces/settings.routes.js';
import { registerAuditRoutes } from '../modules/audit/interfaces/audit.routes.js';
import { registerChatWebhookRoutes } from '../modules/chat-sdk/interfaces/chat-webhook.routes.js';
import { registerToolDefinitionRoutes } from '../modules/tool-definitions/interfaces/tool-definition.routes.js';
import { registerTeamPlanRoutes } from '../modules/team-planning/interfaces/team-plan.routes.js';
import { registerAgentGovernanceRoutes } from '../modules/agent-governance/interfaces/agent-governance.routes.js';
import { registerAgentPlanRoutes } from '../modules/agent-planning/interfaces/agent-plan.routes.js';
import { registerRunRoutes } from '../modules/runs/interfaces/run.routes.js';
import { registerPlatformAgentRoutes } from '../modules/platform-agents/interfaces/platform-agent.routes.js';
import { registerGovernanceRoutes } from '../modules/governance/interfaces/governance.routes.js';
import { registerSchedulingRoutes } from '../modules/scheduling/interfaces/scheduling.routes.js';
import { registerPartyRoutes } from '../modules/crm/interfaces/party.routes.js';
import { registerObservabilityRoutes } from '../modules/observability/interfaces/observability.routes.js';
import { registerPlatformRoutes } from '../modules/platform/interfaces/platform.routes.js';
import { registerBusinessActionRoutes } from '../modules/business-tools/interfaces/business-actions.routes.js';

export async function registerRoutes(app: FastifyInstance, env: IEnv, injectedDeps?: IAppDeps) {
  const resolvedDeps = injectedDeps ?? createDeps(env);
  await app.register(
    async (r) => {
      await registerAuthRoutes(r, resolvedDeps);
      await registerWorkspaceRoutes(r, resolvedDeps);
      await registerAgentRoutes(r, resolvedDeps);
      await registerAgentGovernanceRoutes(r, resolvedDeps);
      await registerAgentMcpBindingRoutes(r, resolvedDeps);
      await registerMcpRoutes(r, resolvedDeps);
      await registerTeamRoutes(r, resolvedDeps);
      await registerTemplateRoutes(r, resolvedDeps);
      await registerChannelRoutes(r, resolvedDeps);
      await registerKnowledgeRoutes(r, resolvedDeps);
      await registerDashboardRoutes(r, resolvedDeps);
      await registerSettingsRoutes(r, resolvedDeps);
      await registerAuditRoutes(r, resolvedDeps);
      await registerToolDefinitionRoutes(r, resolvedDeps);
      await registerBusinessActionRoutes(r, resolvedDeps);
      await registerAgentPlanRoutes(r, resolvedDeps);
      await registerTeamPlanRoutes(r, resolvedDeps);
      await registerRunRoutes(r, resolvedDeps);
      await registerPlatformAgentRoutes(r, resolvedDeps);
      await registerGovernanceRoutes(r, resolvedDeps);
      await registerSchedulingRoutes(r, resolvedDeps);
      await registerPartyRoutes(r, resolvedDeps);
      await registerObservabilityRoutes(r, resolvedDeps);
      await registerPlatformRoutes(r, resolvedDeps);
      await registerPlatformTemplateRoutes(r, resolvedDeps);
      await registerChatWebhookRoutes(r, env, resolvedDeps);
    },
    { prefix: '/api/v1' },
  );
}
