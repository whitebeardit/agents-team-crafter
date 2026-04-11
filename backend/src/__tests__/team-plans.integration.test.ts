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
});
