/**
 * Seed completo com workspaces demo, agentes, canais, etc.
 * Uso: USE_FULL_DEMO_SEED=1 npx tsx scripts/seed.ts
 * ou: npx tsx scripts/seed-demo.ts
 */
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
import { MOCK_SYNCED_TOOLS } from '../src/modules/mcps/infra/mcp-connection.repository.js';

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

  const u = await UserModel.create({
    email: 'admin@whitebeard.dev',
    passwordHash,
    name: 'Admin Seed',
    workspaceIds: [],
    isPlatformAdmin: true,
  });

  const w1 = await WorkspaceModel.create({
    name: 'Workspace Alpha',
    logo: '/workspace-default.svg',
    plan: 'enterprise',
    settings: { defaultLanguage: 'pt-BR', timezone: 'America/Sao_Paulo' },
    limits: { maxTeams: -1, maxAgents: -1, maxChannels: -1 },
  });

  const w2 = await WorkspaceModel.create({
    name: 'Workspace Beta',
    plan: 'pro',
    settings: {},
    limits: {},
  });

  await UserModel.findByIdAndUpdate(u._id, {
    $set: { workspaceIds: [w1._id, w2._id] },
  });

  await WorkspaceMemberModel.create([
    { workspaceId: w1._id, userId: u._id, role: 'owner', joinedAt: new Date() },
    { workspaceId: w2._id, userId: u._id, role: 'admin', joinedAt: new Date() },
  ]);

  const mkAgent = (w: typeof w1, data: Record<string, unknown>) =>
    AgentModel.create({ ...data, workspaceId: w._id });

  const a1 = await mkAgent(w1, {
    name: 'Atlas Coordinator',
    description: 'Coordenador',
    role: 'coordinator',
    origin: 'whitebeard',
    skills: ['Orquestracao'],
    version: '2.1.0',
    category: 'Coordenacao',
    channels: ['whatsapp', 'slack'],
    status: 'active',
  });

  await mkAgent(w1, {
    name: 'Nova Assistant',
    description: 'Especialista',
    role: 'specialist',
    origin: 'whitebeard',
    skills: ['Atendimento'],
    version: '1.0.0',
    category: 'Atendimento',
    channels: [],
    status: 'active',
  });

  await mkAgent(w1, {
    name: 'Monitor Bot',
    description: 'Monitoramento',
    role: 'specialist',
    origin: 'whitebeard',
    skills: ['Monitoramento'],
    version: '1.0.0',
    category: 'Monitoramento',
    channels: [],
    status: 'active',
  });

  await mkAgent(w1, {
    name: 'Company Agent One',
    description: 'Custom',
    role: 'specialist',
    origin: 'company',
    skills: ['CRM'],
    version: '1.0.0',
    category: 'Vendas',
    channels: [],
    status: 'active',
  });

  await mkAgent(w1, {
    name: 'Company Agent Two',
    description: 'Custom 2',
    role: 'specialist',
    origin: 'company',
    skills: ['Suporte'],
    version: '1.0.0',
    category: 'Suporte',
    channels: [],
    status: 'active',
  });

  const c1 = await ChannelModel.create({
    workspaceId: w1._id,
    type: 'whatsapp',
    name: 'WhatsApp Business',
    status: 'connected',
    config: { phoneNumber: '+55 11 99999-9999' },
  });

  const c2 = await ChannelModel.create({
    workspaceId: w1._id,
    type: 'slack',
    provider: 'chat_sdk',
    platform: 'slack',
    name: 'Slack Suporte',
    status: 'pending',
    config: { workspace: 'techcorp', slackTeamId: 'T_EXEMPLO_SEED' },
  });
  void c2;

  const team = await TeamModel.create({
    workspaceId: w1._id,
    name: 'Atendimento WhatsApp',
    description: 'Time principal',
    status: 'active',
    coordinatorId: a1._id,
    agentIds: [],
    channelIds: [c1._id],
    primaryChannel: 'whatsapp',
  });

  const coordIdStr = a1._id.toString();
  const channelIdStr = c1._id.toString();
  await TeamGraphModel.create({
    workspaceId: w1._id,
    teamId: team._id,
    nodes: [
      {
        id: coordIdStr,
        type: 'coordinator',
        data: { label: 'Atlas', agentId: coordIdStr },
        position: { x: 400, y: 50 },
      },
      {
        id: channelIdStr,
        type: 'channel',
        data: { label: 'WhatsApp', channelId: channelIdStr },
        position: { x: 400, y: 350 },
      },
    ],
    edges: [{ id: 'edge-1', source: channelIdStr, target: coordIdStr, type: 'smoothstep' }],
  });

  await TemplateModel.create([
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Atendimento Omnichannel',
      description: 'Template completo para atendimento ao cliente em multiplos canais.',
      version: '2.0.0',
      category: 'Atendimento',
      agentCount: 4,
      teamConfig: {
        name: 'Atendimento Omnichannel',
        description: 'Time de atendimento multicanal',
      },
      graph: {
        nodes: [
          {
            id: coordIdStr,
            type: 'coordinator',
            data: { label: 'Coord', agentId: coordIdStr },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      },
      agentsSnapshot: [{ id: a1._id.toString(), name: 'Atlas Coordinator', role: 'coordinator' }],
    },
    {
      workspaceId: w1._id,
      origin: 'company',
      name: 'Template do time Atendimento',
      description: 'Salvo a partir do time seed',
      version: '1.0.0',
      category: 'Geral',
      agentCount: 1,
      teamConfig: { name: team.name, description: team.description },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ id: a1._id.toString(), name: 'Atlas Coordinator', role: 'coordinator' }],
    },
  ]);

  const mcpFiscal = await McpConnectionModel.create({
    workspaceId: w1._id,
    name: 'Fiscal API',
    description: 'Conexao com sistema fiscal',
    status: 'connected',
    tools: MOCK_SYNCED_TOOLS,
    icon: 'receipt',
    config: { endpoint: 'https://api.fiscal.com/v1', authType: 'api_key' },
  });
  void mcpFiscal;

  const mcpCrm = await McpConnectionModel.create({
    workspaceId: w1._id,
    name: 'CRM Salesforce',
    description: 'Integracao CRM',
    status: 'pending',
    tools: [],
    icon: 'users',
    config: { endpoint: 'https://salesforce.com/api' },
  });

  const companyAgent = await AgentModel.findOne({
    workspaceId: w1._id,
    name: 'Company Agent One',
  });

  if (companyAgent) {
    await AgentMcpBindingModel.create({
      workspaceId: w1._id,
      agentId: companyAgent._id,
      mcpConnectionId: mcpCrm._id,
      allowedTools: [],
      requiresApproval: true,
    });
  }

  await KnowledgeSourceModel.create([
    {
      workspaceId: w1._id,
      name: 'Base de Conhecimento - FAQ',
      type: 'document',
      description: 'Perguntas frequentes',
      status: 'active',
      lastSyncAt: new Date(),
      itemCount: 250,
      config: { sourceUrl: 'https://storage.example.com/docs', syncInterval: 'daily' },
    },
    {
      workspaceId: w1._id,
      name: 'Site Publico',
      type: 'website',
      description: 'Conteudo do site',
      status: 'inactive',
      itemCount: 0,
      config: { url: 'https://example.com' },
    },
  ]);

  console.log('Seed demo OK. Login: admin@whitebeard.dev / Admin123!');
  console.log('Workspaces:', w1._id.toString(), w2._id.toString());
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
