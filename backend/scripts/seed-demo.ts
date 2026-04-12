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
    category: 'coordenacao',
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
    category: 'atendimento',
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
    category: 'monitoramento',
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
    category: 'vendas',
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
    category: 'suporte',
    channels: [],
    status: 'active',
  });

  const psychSpecialist = await mkAgent(w1, {
    name: 'Especialista Saude Mental',
    description: 'Triagem e encaminhamento em contexto clinico (demo seed).',
    role: 'specialist',
    origin: 'company',
    skills: ['escuta', 'triage'],
    version: '1.0.0',
    category: 'saude',
    channels: [],
    status: 'active',
  });
  void psychSpecialist;

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
      description:
        'Base para um time de atendimento. O `aplicar` cria um time em rascunho e reutiliza agentes ja existentes no workspace cujos nomes coincidem com o modelo (nao cria agentes novos automaticamente).',
      version: '2.1.0',
      category: 'atendimento',
      vertical: 'atendimento',
      agentCount: 1,
      prerequisites: [
        'Pelo menos um agente coordenador no workspace (o primeiro por ordem alfabetica e usado como lider do novo time).',
        'Agentes listados no modelo devem existir com o mesmo nome para serem associados ao time.',
        'Canais opcionais: seleccione canais ja ligados ao workspace para anexar ao novo time.',
      ],
      applyBehavior:
        'Cria `Team` em estado rascunho, copia o grafo guardado no template e associa IDs de agentes encontrados por nome. Nao provisiona canais nem MCPs.',
      validationSteps: [
        'Active o time (ou deixe em rascunho) e abra a aba Debug.',
        'Envie um prompt de teste; confira a run em Execução.',
        'Se o readiness mostrar bloqueios (canais, tools), resolva na ficha do time.',
      ],
      goldenPrompts: [
        'Olá, preciso de ajuda com um pedido de suporte.',
        'Qual o horário de atendimento?',
      ],
      expectedOutcome:
        'O coordenador responde de forma útil; em cenários reais o especialista seria acionado quando configurado no grafo e nas tools.',
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
      origin: 'whitebeard',
      name: 'Clinica Psicologia — triagem',
      description:
        'Exemplo curado para consultorio: coordenador + especialista de saude mental no mesmo workspace. Demonstra vertical saude com agentes de seed reutilizaveis.',
      version: '1.0.0',
      category: 'saude',
      vertical: 'saude',
      agentCount: 2,
      prerequisites: [
        'Agentes de seed `Atlas Coordinator` e `Especialista Saude Mental` presentes (nomes iguais aos do modelo).',
        'O coordenador efectivo do novo time e o primeiro coordenador do workspace por nome — neste demo e o Atlas.',
        'Ligar canais depois em Configuracoes ou no proprio time.',
      ],
      applyBehavior:
        'Cria time rascunho; associa o coordenador por regra do servidor e inclui o especialista se o nome existir. Revise o grafo no editor de times apos aplicar.',
      validationSteps: [
        'Revise o readiness e ligue canais se necessário.',
        'Na aba Debug, teste um prompt de triagem.',
        'Verifique em Execução se os passos batem com o esperado.',
      ],
      goldenPrompts: [
        'Quero marcar uma primeira consulta de psicologia para a próxima semana.',
        'Estou com ansiedade e gostaria de ser encaminhado.',
      ],
      expectedOutcome:
        'Resposta acolhedora; triagem ou pedido de dados em falta conforme prompts do especialista de saúde mental.',
      teamConfig: {
        name: 'Clinica — triagem',
        description: 'Fluxo de triagem e encaminhamento (demo)',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [
        { id: a1._id.toString(), name: 'Atlas Coordinator', role: 'coordinator' },
        { name: 'Especialista Saude Mental', role: 'specialist' },
      ],
    },
    {
      workspaceId: w1._id,
      origin: 'company',
      name: 'Template do time Atendimento WhatsApp',
      description:
        'Template guardado a partir do time seed `Atendimento WhatsApp` (mesma estrutura de agentes/canais do demo).',
      version: '1.0.0',
      category: 'geral',
      vertical: 'atendimento',
      agentCount: 1,
      prerequisites: ['Mesmos agentes e nomes que no momento em que o template foi gravado.'],
      applyBehavior: 'Equivalente aos outros templates de empresa: reaproveita agentes por nome.',
      validationSteps: [
        'Confirme que os nomes dos agentes no workspace ainda coincidem com o modelo.',
        'Aplique e abra o Debug para validar uma mensagem simples.',
      ],
      goldenPrompts: ['Teste de mensagem após aplicar template da empresa.'],
      expectedOutcome: 'Time criado em rascunho com grafo e agentes associados por nome quando existirem.',
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
