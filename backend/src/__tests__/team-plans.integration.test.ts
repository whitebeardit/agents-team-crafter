import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';

/** JSON valido para o schema do planner (Chat Completions mock). */
const MOCK_LLM_PLAN = {
  team: {
    name: 'Time Atendimento Cliente',
    objective: 'Melhorar atendimento e reduzir tempo de resposta dos clientes com fluxo coordenado.',
    description: 'Plano gerado para teste de integracao.',
    channelIds: [],
  },
  agents: [
    {
      name: 'Coordenador CX',
      role: 'coordinator',
      description: 'Coordena especialistas.',
      objective: 'Garantir SLA de resposta.',
      responsibilities: ['Priorizar fila', 'Escalar'],
      skills: ['comunicacao'],
      category: 'atendimento',
      channels: ['api'],
    },
    {
      name: 'Especialista Resposta',
      role: 'specialist',
      description: 'Responde clientes.',
      objective: 'Resolver tickets.',
      responsibilities: ['Responder'],
      skills: ['empatia'],
      category: 'atendimento',
      channels: [],
    },
  ],
  graph: { nodes: [], edges: [] },
  executionChecklist: ['Validar canais'],
};

function mockFetchOpenAiSuccess() {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(MOCK_LLM_PLAN) } }],
      }),
  } as Response;
}

describe('team-plans flow', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'PlanWs', plan: 'enterprise' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'planner@test.com',
      passwordHash,
      name: 'Planner',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });
    app = await buildApp(env);
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockFetchOpenAiSuccess());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'planner@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('creates, updates and executes a team plan', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    const created = (
      JSON.parse(create.body) as {
        data: { id: string; team: { name: string }; plannerMeta: { usedOpenAi: boolean; usedFallback: boolean } };
      }
    ).data;
    expect(created.id).toBeTruthy();
    expect(created.plannerMeta.usedOpenAi).toBe(true);
    expect(created.plannerMeta.usedFallback).toBe(false);
    expect(created.team.name).toBe('Time Atendimento Cliente');

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${created.id}`,
      headers,
      payload: {
        team: {
          name: 'Time Atendimento IA',
          objective: 'Reduzir TMA',
          description: 'Plano ajustado pelo usuario',
          channelIds: [],
        },
      },
    });
    expect(update.statusCode).toBe(200);

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${created.id}/execute`,
      headers,
      payload: { operationId: 'op-test-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const executed = (JSON.parse(execute.body) as { data: { result?: { teamId?: string } } }).data;
    expect(executed.result?.teamId).toBeTruthy();
  });

  it('streams execute phases and completes', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Queremos criar um time para triagem e resposta automatica via API.',
      },
    });
    expect(create.statusCode).toBe(201);
    const created = (JSON.parse(create.body) as { data: { id: string } }).data;

    const stream = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${created.id}/execute/stream`,
      headers,
      payload: { operationId: 'op-test-stream-0001' },
    });
    expect(stream.statusCode).toBe(200);
    const body = stream.body;
    expect(body).toContain('event: phase');
    expect(body).toContain('event: complete');
  });

  it('uses fallback and plannerMeta when OpenAI HTTP fails', async () => {
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_api_key"}',
    } as Response);

    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    const data = (
      JSON.parse(create.body) as {
        data: {
          plannerMeta: { usedFallback: boolean; fallbackReason?: string; usedOpenAi: boolean };
          team: { name: string };
        };
      }
    ).data;
    expect(data.plannerMeta.usedFallback).toBe(true);
    expect(data.plannerMeta.usedOpenAi).toBe(false);
    expect(data.plannerMeta.fallbackReason).toBe('openai_request_failed');
    expect(data.team.name.startsWith('Time Precisamos melhorar')).toBe(true);
  });

  it('repara colisao de catalogTools na criacao com segunda chamada OpenAI (Loop 80)', async () => {
    jest.restoreAllMocks();
    const collisionPlan = {
      team: {
        name: 'Time Colisao',
        objective: 'Testar validacao de ferramentas exclusivas entre especialistas no servidor.',
        description: 'Teste integracao',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'c',
          objective: 'o',
          responsibilities: [] as string[],
          skills: [] as string[],
          category: 'c',
          channels: ['api'],
          catalogTools: ['web_search'],
        },
        {
          name: 'Esp A',
          role: 'specialist',
          description: 'd',
          objective: 'o',
          responsibilities: [],
          skills: [],
          category: 'a',
          channels: [],
          catalogTools: ['database_query'],
        },
        {
          name: 'Esp B',
          role: 'specialist',
          description: 'd',
          objective: 'o',
          responsibilities: [],
          skills: [],
          category: 'b',
          channels: [],
          catalogTools: ['database_query'],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [] as string[],
      requiredPacks: [] as string[],
      requiredTools: [] as string[],
    };
    const repairedPlan = {
      ...collisionPlan,
      agents: collisionPlan.agents.map((a, i) =>
        i === 2 ? { ...a, catalogTools: ['calendar_access'] } : a,
      ),
    };
    let fetchCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      fetchCount++;
      const payload = fetchCount === 1 ? collisionPlan : repairedPlan;
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          }),
      } as Response;
    });

    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    expect(fetchCount).toBe(2);
    const body = JSON.parse(create.body) as {
      data: {
        plannerMeta: {
          catalogToolRepairAttempts?: number;
          catalogUniquenessRepaired?: boolean;
          usedOpenAi: boolean;
        };
      };
    };
    expect(body.data.plannerMeta.catalogToolRepairAttempts).toBe(1);
    expect(body.data.plannerMeta.catalogUniquenessRepaired).toBe(true);
    expect(body.data.plannerMeta.usedOpenAi).toBe(true);
  });

  it('repara workflowKey duplicado na criacao com segunda chamada OpenAI (Loop 86)', async () => {
    jest.restoreAllMocks();
    const workflowCollisionPlan = {
      team: {
        name: 'Time Workflow Dup',
        objective: 'Testar unicidade de workflow entre especialistas no servidor.',
        description: 'Teste integracao',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'c',
          objective: 'o',
          responsibilities: [] as string[],
          skills: [] as string[],
          category: 'c',
          channels: ['api'],
          catalogTools: ['web_search'],
          workflowKey: 'coordination',
          requiredBusinessActionIds: [] as string[],
          requiredPackIds: [] as string[],
        },
        {
          name: 'Esp A',
          role: 'specialist',
          description: 'd',
          objective: 'o',
          responsibilities: [],
          skills: [],
          category: 'a',
          channels: [],
          catalogTools: ['web_search'],
          workflowKey: 'same_flow',
          requiredBusinessActionIds: [],
          requiredPackIds: [],
        },
        {
          name: 'Esp B',
          role: 'specialist',
          description: 'd',
          objective: 'o',
          responsibilities: [],
          skills: [],
          category: 'b',
          channels: [],
          catalogTools: ['file_search'],
          workflowKey: 'same_flow',
          requiredBusinessActionIds: [],
          requiredPackIds: [],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [] as string[],
      requiredPacks: [] as string[],
      requiredTools: [] as string[],
    };
    const repairedPlan = {
      ...workflowCollisionPlan,
      agents: workflowCollisionPlan.agents.map((a, i) =>
        i === 2 ? { ...a, workflowKey: 'same_flow_b' } : a,
      ),
    };
    let fetchCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      fetchCount++;
      const payload = fetchCount === 1 ? workflowCollisionPlan : repairedPlan;
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          }),
      } as Response;
    });

    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    expect(fetchCount).toBe(2);
    const body = JSON.parse(create.body) as {
      data: { agents: Array<{ workflowKey?: string }> };
    };
    expect(body.data.agents[2]!.workflowKey).toBe('same_flow_b');
  });

  it('rejeita atualizacao manual quando dois especialistas partilham workflowKey (Loop 86)', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const agentsBad = [
      {
        name: 'Coordenador CX',
        role: 'coordinator',
        description: 'Coordena especialistas.',
        objective: 'Garantir SLA de resposta.',
        responsibilities: ['Priorizar fila', 'Escalar'],
        skills: ['comunicacao'],
        category: 'atendimento',
        channels: ['api'],
        catalogTools: ['web_search'],
        workflowKey: 'coordination',
        requiredBusinessActionIds: [],
        requiredPackIds: [],
      },
      {
        name: 'Especialista Resposta',
        role: 'specialist',
        description: 'Responde clientes.',
        objective: 'Resolver tickets.',
        responsibilities: ['Responder'],
        skills: ['empatia'],
        category: 'atendimento',
        channels: [],
        catalogTools: ['database_query'],
        workflowKey: 'wf_dup',
        requiredBusinessActionIds: [],
        requiredPackIds: [],
      },
      {
        name: 'Especialista Dados',
        role: 'specialist',
        description: 'SQL.',
        objective: 'Relatorios.',
        responsibilities: ['Query'],
        skills: ['sql'],
        category: 'dados',
        channels: [],
        catalogTools: ['calendar_access'],
        workflowKey: 'wf_dup',
        requiredBusinessActionIds: [],
        requiredPackIds: [],
      },
    ];

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${planId}`,
      headers,
      payload: { agents: agentsBad },
    });
    expect(update.statusCode).toBe(400);
    const envelope = JSON.parse(update.body) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe('VALIDATION_ERROR');
    expect(envelope.error.message).toMatch(/workflow/i);
  });

  it('rejeita atualizacao manual quando dois especialistas partilham catalogTools de dominio', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const agentsBad = [
      {
        name: 'Coordenador CX',
        role: 'coordinator',
        description: 'Coordena especialistas.',
        objective: 'Garantir SLA de resposta.',
        responsibilities: ['Priorizar fila', 'Escalar'],
        skills: ['comunicacao'],
        category: 'atendimento',
        channels: ['api'],
        catalogTools: ['web_search'],
      },
      {
        name: 'Especialista Resposta',
        role: 'specialist',
        description: 'Responde clientes.',
        objective: 'Resolver tickets.',
        responsibilities: ['Responder'],
        skills: ['empatia'],
        category: 'atendimento',
        channels: [],
        catalogTools: ['database_query'],
      },
      {
        name: 'Especialista Dados',
        role: 'specialist',
        description: 'SQL.',
        objective: 'Relatorios.',
        responsibilities: ['Query'],
        skills: ['sql'],
        category: 'dados',
        channels: [],
        catalogTools: ['database_query'],
      },
    ];

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${planId}`,
      headers,
      payload: { agents: agentsBad },
    });
    expect(update.statusCode).toBe(400);
    const envelope = JSON.parse(update.body) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe('VALIDATION_ERROR');
    expect(envelope.error.message).toContain('database_query');
  });
});
