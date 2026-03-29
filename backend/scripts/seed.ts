import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { loadDotenv } from '../src/config/load-dotenv.js';

loadDotenv();
import { UserModel } from '../src/modules/users/infra/user.model.js';
import { WorkspaceModel } from '../src/modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../src/modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../src/modules/agents/infra/agent.model.js';
import { ChannelModel } from '../src/modules/channels/infra/channel.model.js';
import { TeamModel } from '../src/modules/teams/infra/team.model.js';
import { TeamGraphModel } from '../src/modules/graphs/infra/team-graph.model.js';
import { InviteModel } from '../src/modules/workspaces/infra/invite.model.js';
import { TemplateModel } from '../src/modules/templates/infra/template.model.js';
import { McpConnectionModel } from '../src/modules/mcps/infra/mcp-connection.model.js';
import { AgentMcpBindingModel } from '../src/modules/agents/infra/agent-mcp-binding.model.js';
import { KnowledgeSourceModel } from '../src/modules/knowledge/infra/knowledge-source.model.js';
import { ApiKeyModel } from '../src/modules/settings/infra/api-key.model.js';
import { AuditLogModel } from '../src/modules/audit/infra/audit-log.model.js';

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  await Promise.all([
    UserModel.deleteMany({}),
    WorkspaceModel.deleteMany({}),
    WorkspaceMemberModel.deleteMany({}),
    InviteModel.deleteMany({}),
    AgentModel.deleteMany({}),
    ChannelModel.deleteMany({}),
    TeamModel.deleteMany({}),
    TeamGraphModel.deleteMany({}),
    TemplateModel.deleteMany({}),
    McpConnectionModel.deleteMany({}),
    AgentMcpBindingModel.deleteMany({}),
    KnowledgeSourceModel.deleteMany({}),
    ApiKeyModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await UserModel.create({
    email: 'admin@whitebeard.dev',
    passwordHash,
    name: 'Admin Seed',
    workspaceIds: [],
    isPlatformAdmin: true,
  });

  console.log('Seed OK (admin global only). Login: admin@whitebeard.dev / Admin123!');
  console.log('Demo completa: npx tsx scripts/seed-demo.ts');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
