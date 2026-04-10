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

const MOCK_LLM_PLAN = {
  team: {
    name: 'Time CRM Auto Bind',
    objective: 'Melhorar cadastro e consulta de clientes com fluxo coordenado e seguro.',
    description: 'Plano gerado para teste de integracao auto-bind.',
    channelIds: [],
  },
  agents: [
    {
      name: 'Coord CRM',
      role: 'coordinator',
      description: 'Coordena especialistas.',
      objective: 'Garantir uso correto das tools de CRM.',
      responsibilities: ['Priorizar'],
      skills: ['comunicacao'],
      category: 'atendimento',
      channels: ['api'],
    },
    {
      name: 'Especialista CRM',
      role: 'specialist',
      description: 'Opera CRM.',
      objective: 'Cadastrar partes.',
      responsibilities: ['CRM'],
      skills: ['dados'],
      category: 'atendimento',
      channels: [],
    },
  ],
  graph: { nodes: [], edges: [] },
  executionChecklist: ['Validar CRM'],
  requiredPacks: [] as string[],
  requiredTools: ['crm_create_party'],
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

describe('team-plan execute with TEAM_PLAN_AUTO_BIND_TOOLS=1', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3002,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
    TEAM_PLAN_AUTO_BIND_TOOLS: '1',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'AutoBindWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'autobind-planner@test.com',
      passwordHash,
      name: 'AutoBind Planner',
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
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'autobind-planner@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('binds WorkspaceToolDefinition ids to new agents when executing plan with requiredTools', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos cadastrar e consultar clientes com CRM integrado ao time.',
      },
    });
    expect(create.statusCode).toBe(201);
    const created = (JSON.parse(create.body) as { data: { id: string; requiredTools: string[] } }).data;
    expect(created.requiredTools).toContain('crm_create_party');

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${created.id}/execute`,
      headers,
      payload: { operationId: 'op-autobind-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const body = JSON.parse(execute.body) as {
      meta: {
        autoBindEnabled?: boolean;
        boundToolDefinitionIds?: string[];
        autoBindActionsRequested?: number;
        autoBindActionsApplied?: number;
        autoBindActionsTruncated?: boolean;
      };
      data: {
        result?: {
          createdAgents?: Array<{ id: string; reused?: boolean }>;
        };
      };
    };
    expect(body.meta.autoBindEnabled).toBe(true);
    expect(body.meta.autoBindActionsRequested).toBe(1);
    expect(body.meta.autoBindActionsApplied).toBe(1);
    expect(body.meta.autoBindActionsTruncated).toBe(false);
    expect(body.meta.boundToolDefinitionIds?.length).toBeGreaterThan(0);
    const boundIds = body.meta.boundToolDefinitionIds ?? [];

    const createdAgents = body.data.result?.createdAgents ?? [];
    const newAgentRows = createdAgents.filter((a) => !a.reused);
    expect(newAgentRows.length).toBeGreaterThan(0);

    for (const row of newAgentRows) {
      const agentRes = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${row.id}`,
        headers,
      });
      expect(agentRes.statusCode).toBe(200);
      const agent = (JSON.parse(agentRes.body) as { data: { capabilities?: { customToolDefinitionIds?: string[] } } })
        .data;
      const custom = agent.capabilities?.customToolDefinitionIds ?? [];
      for (const id of boundIds) {
        expect(custom).toContain(id);
      }
    }

    const metrics = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(metrics.statusCode).toBe(200);
    expect(String(metrics.headers['content-type'])).toContain('text/plain');
    expect(metrics.body).toContain('agents_team_crafter_team_plan_execute_total');
    expect(metrics.body).toContain('outcome="success"');
    expect(metrics.body).toContain('auto_bind_enabled="true"');
    expect(metrics.body).toContain('agents_team_crafter_team_plan_auto_bind_actions_requested');
  });

  it('is idempotent for the same operationId when plan already executed', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Segunda execucao idempotente para CRM e clientes no mesmo workspace de teste.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;
    const op = 'op-autobind-idem-0001';

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${planId}/execute`,
      headers,
      payload: { operationId: op },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${planId}/execute`,
      headers,
      payload: { operationId: op },
    });
    expect(second.statusCode).toBe(200);
    const meta = (JSON.parse(second.body) as { meta: { boundToolDefinitionIds?: string[] } }).meta;
    expect(meta.boundToolDefinitionIds).toBeUndefined();
  });
});
