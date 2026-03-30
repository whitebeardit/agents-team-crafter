import type { FastifyInstance } from 'fastify';
import type { IEnv } from '../config/env.js';
import { createDeps, type IAppDeps } from '../config/container.js';
import { registerAuthRoutes } from '../modules/auth/interfaces/auth.routes.js';
import { registerWorkspaceRoutes } from '../modules/workspaces/interfaces/workspace.routes.js';
import { registerAgentRoutes } from '../modules/agents/interfaces/agent.routes.js';
import { registerAgentMcpBindingRoutes } from '../modules/agents/interfaces/agent-mcp-binding.routes.js';
import { registerMcpRoutes } from '../modules/mcps/interfaces/mcp.routes.js';
import { registerTeamRoutes } from '../modules/teams/interfaces/team.routes.js';
import { registerTemplateRoutes } from '../modules/templates/interfaces/template.routes.js';
import { registerChannelRoutes } from '../modules/channels/interfaces/channel.routes.js';
import { registerKnowledgeRoutes } from '../modules/knowledge/interfaces/knowledge.routes.js';
import { registerDashboardRoutes } from '../modules/dashboard/interfaces/dashboard.routes.js';
import { registerSettingsRoutes } from '../modules/settings/interfaces/settings.routes.js';
import { registerAuditRoutes } from '../modules/audit/interfaces/audit.routes.js';
import { registerChatWebhookRoutes } from '../modules/chat-sdk/interfaces/chat-webhook.routes.js';

export async function registerRoutes(app: FastifyInstance, env: IEnv, deps?: IAppDeps) {
  const d = deps ?? createDeps(env);
  await app.register(
    async (r) => {
      await registerAuthRoutes(r, d);
      await registerWorkspaceRoutes(r, d);
      await registerAgentRoutes(r, d);
      await registerAgentMcpBindingRoutes(r, d);
      await registerMcpRoutes(r, d);
      await registerTeamRoutes(r, d);
      await registerTemplateRoutes(r, d);
      await registerChannelRoutes(r, d);
      await registerKnowledgeRoutes(r, d);
      await registerDashboardRoutes(r, d);
      await registerSettingsRoutes(r, d);
      await registerAuditRoutes(r, d);
      await registerChatWebhookRoutes(r, env, d);
    },
    { prefix: '/api/v1' },
  );
}
