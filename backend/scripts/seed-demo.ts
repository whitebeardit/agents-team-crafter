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

  // Workspace Alpha fica sem agentes/times até o wizard importar SO Clínica Gold (ou o utilizador criar conteúdo).
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
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ name: 'Atlas Coordinator', role: 'coordinator' }],
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
        { name: 'Atlas Coordinator', role: 'coordinator' },
        { name: 'Especialista Saude Mental', role: 'specialist' },
      ],
    },
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Clinica Medica — agenda clinica',
      description:
        'Starter team para clínica médica com foco em agenda, triagem e registro clínico operacional.',
      version: '1.0.0',
      category: 'clinical',
      vertical: 'clinical',
      agentCount: 2,
      prerequisites: [
        'Agentes `Atlas Coordinator` e `Especialista Saude Mental` disponíveis (ou equivalentes no workspace).',
        'Canais podem ser ligados após aplicar o template.',
      ],
      applyBehavior:
        'Cria time em rascunho com configuração inicial clínica; reutiliza agentes por nome e permite ajustes no grafo após aplicação.',
      validationSteps: [
        'Validar readiness do time e pendências de canais.',
        'No Debug, testar prompt de agendamento de consulta.',
        'Conferir em Execução se houve coleta de dados em falta para triagem.',
      ],
      goldenPrompts: [
        'Quero marcar consulta para avaliação clínica na próxima terça.',
        'Preciso reagendar retorno médico para a semana que vem.',
      ],
      expectedOutcome:
        'Fluxo de atendimento clínico com pedido de dados necessários e encaminhamento para agenda operacional.',
      teamConfig: {
        name: 'Clinica Medica — operação',
        description: 'Agenda + triagem + registro clínico (starter)',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [
        { name: 'Atlas Coordinator', role: 'coordinator' },
        { name: 'Especialista Saude Mental', role: 'specialist' },
      ],
    },
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Empresa de Servicos — CRM Scheduling Finance',
      description:
        'Starter team para empresas de serviços com captação comercial, agenda de execução e acompanhamento financeiro.',
      version: '1.0.0',
      category: 'services-sales',
      vertical: 'services',
      agentCount: 2,
      prerequisites: [
        'Coordenador operacional ativo no workspace.',
        'Recomendado ligar canal de atendimento para operação diária.',
      ],
      applyBehavior:
        'Cria time em rascunho e habilita base de operação services/sales para ajustes rápidos de CRM, scheduling e financeiro.',
      validationSteps: [
        'Abrir o time no Debug e validar fluxo comercial inicial.',
        'Executar prompt de proposta/fechamento e confirmar próximos passos.',
        'Testar atualização de cobrança no cenário financeiro.',
      ],
      goldenPrompts: [
        'Quero enviar proposta para um novo serviço e marcar visita técnica.',
        'Mostre oportunidades abertas e pendências financeiras desta semana.',
      ],
      expectedOutcome:
        'Operação integrada entre CRM, agenda e financeiro com decisões claras de follow-up.',
      teamConfig: {
        name: 'Servicos — operação integrada',
        description: 'CRM + agenda + financeiro para execução diária',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ name: 'Atlas Coordinator', role: 'coordinator' }],
    },
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Consultoria Comercial — CRM Finance',
      description:
        'Starter team para consultoria com foco em funil comercial, agenda de reuniões e gestão de cobrança.',
      version: '1.0.0',
      category: 'consultoria',
      vertical: 'sales',
      agentCount: 1,
      prerequisites: [
        'Coordenador operacional disponível no workspace.',
        'Ideal ter integração de canal para acompanhamento de leads.',
      ],
      applyBehavior:
        'Cria time em rascunho com base consultiva/comercial; reutiliza agentes existentes por nome.',
      validationSteps: [
        'Testar prompt de captação de leads e qualificação inicial.',
        'Validar criação de próximos passos com agenda de reuniões.',
        'Simular follow-up de cobrança em atraso.',
      ],
      goldenPrompts: [
        'Liste leads quentes e proponha agenda comercial da semana.',
        'Mostre clientes com cobrança pendente e plano de follow-up.',
      ],
      expectedOutcome:
        'Resposta orientada a pipeline comercial com priorização de reuniões e cobrança.',
      teamConfig: {
        name: 'Consultoria — operação comercial',
        description: 'Leads + agenda + cobrança',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ name: 'Atlas Coordinator', role: 'coordinator' }],
    },
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Care Reminders — acompanhamento ativo',
      description:
        'Starter team focado em care/reminders para acompanhamento contínuo, lembretes e follow-up operacional.',
      version: '1.0.0',
      category: 'care-reminders',
      vertical: 'care',
      agentCount: 1,
      prerequisites: [
        'Coordenador operacional disponível no workspace.',
        'Ideal configurar canais de notificação para lembretes.',
      ],
      applyBehavior:
        'Cria time em rascunho orientado a continuidade de cuidado com rastreio de follow-ups e lembretes.',
      validationSteps: [
        'Testar prompt para listar lembretes vencidos por prioridade.',
        'Confirmar atualização de follow-up e sugestão de próximo contato.',
      ],
      goldenPrompts: [
        'Liste os lembretes de acompanhamento vencidos e priorize por risco.',
        'Registre follow-up concluído e proponha próximo contato.',
      ],
      expectedOutcome:
        'Resposta com foco em continuidade de cuidado, priorização de lembretes e próximas ações claras.',
      teamConfig: {
        name: 'Care — acompanhamento contínuo',
        description: 'Lembretes + follow-up operacional',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ name: 'Atlas Coordinator', role: 'coordinator' }],
    },
    {
      workspaceId: w1._id,
      origin: 'whitebeard',
      name: 'Platform Ops — incidentes e deploy',
      description:
        'Starter team para operação de plataforma com gestão de incidentes, backlog técnico e checklist de deploy.',
      version: '1.0.0',
      category: 'platform-ops',
      vertical: 'platform',
      agentCount: 1,
      prerequisites: [
        'Coordenador operacional disponível no workspace.',
        'Opcional: integrações GitHub/ops conectadas para ampliar automações.',
      ],
      applyBehavior:
        'Cria time em rascunho para governança operacional de incidentes e execução de rotinas de deploy.',
      validationSteps: [
        'Testar prompt para listar incidentes críticos e plano de ação.',
        'Testar prompt de checklist de deploy com riscos e validações.',
      ],
      goldenPrompts: [
        'Liste incidentes críticos abertos e proponha plano de ação por prioridade.',
        'Prepare checklist de deploy com riscos e validações obrigatórias.',
      ],
      expectedOutcome:
        'Resposta orientada a operação de plataforma com priorização de incidentes e preparação segura de deploy.',
      teamConfig: {
        name: 'Platform Ops — rotina operacional',
        description: 'Incidentes + backlog + deploy',
      },
      graph: { nodes: [], edges: [] },
      agentsSnapshot: [{ name: 'Atlas Coordinator', role: 'coordinator' }],
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

  void mcpCrm;

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
