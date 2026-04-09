import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';

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

describe('team-plans execute overlap governance', () => {
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
    const ws = await WorkspaceModel.create({ name: 'OverlapWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'overlap-team@test.com',
      passwordHash,
      name: 'Overlap',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    await AgentModel.create({
      workspaceId: ws._id,
      name: 'Especialista Suporte',
      description: 'Responde clientes e resolve tickets.',
      role: 'specialist',
      origin: 'company',
      skills: ['empatia', 'comunicacao'],
      version: '1.0.0',
      category: 'atendimento',
      channels: [],
      status: 'active',
      goal: 'Resolver tickets',
      responsibilities: ['Responder'],
      domain: {
        summary: 'Atendimento e resposta a clientes',
        keywords: ['empatia', 'atendimento'],
        boundaries: ['Responder'],
        exclusions: [],
      },
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
      payload: { email: 'overlap-team@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('returns 409 on execute when plan has overlap conflicts and overlapMode is blocking', async () => {
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
    const plan = (JSON.parse(create.body) as { data: { id: string; agents: Array<{ planningMode?: string }> } }).data;
    expect(plan.agents.some((a) => a.planningMode === 'conflict')).toBe(true);

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${plan.id}/execute`,
      headers,
      payload: { operationId: 'op-block-conflict-1' },
    });
    expect(execute.statusCode).toBe(409);
  });

  it('returns 200 with governance meta when overlapMode is warning', async () => {
    const headers = await authHeaders();
    await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers,
      payload: {
        settings: {
          governance: { overlapMode: 'warning', agentWizardDefaultPath: true },
        },
      },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos melhorar o atendimento e reduzir tempo de resposta dos clientes.',
      },
    });
    expect(create.statusCode).toBe(201);
    const plan = (JSON.parse(create.body) as { data: { id: string; agents: Array<{ planningMode?: string }> } }).data;
    expect(plan.agents.some((a) => a.planningMode === 'conflict')).toBe(true);

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${plan.id}/execute`,
      headers,
      payload: { operationId: 'op-warn-conflict-1' },
    });
    expect(execute.statusCode).toBe(200);
    const envelope = JSON.parse(execute.body) as {
      data: { result?: { teamId?: string } };
      meta: { governanceWarning?: { decision: string } };
    };
    expect(envelope.data.result?.teamId).toBeTruthy();
    expect(envelope.meta.governanceWarning?.decision).toBe('block');

    await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers,
      payload: {
        settings: {
          governance: { overlapMode: 'blocking', agentWizardDefaultPath: true },
        },
      },
    });
  });
});
