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
import { AgentModel } from '../modules/agents/infra/agent.model.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { WorkspaceToolDefinitionModel } from '../modules/tool-definitions/infra/workspace-tool-definition.model.js';

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
      exampleUserPhrases: [],
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
      exampleUserPhrases: ['Cadastra cliente Joao', 'Busca cliente por telefone'],
    },
  ],
  graph: { nodes: [], edges: [] },
  executionChecklist: ['Validar CRM'],
  requiredPacks: [] as string[],
  requiredTools: ['crm_create_party'],
};

function mockFetchOpenAiSuccess(plan = MOCK_LLM_PLAN) {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(plan) } }],
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
    const ws = await WorkspaceModel.create({ name: 'AutoBindWs', plan: 'enterprise' });
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

describe('team-plan execute with workspace auto-bind policy override', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3003,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
    TEAM_PLAN_AUTO_BIND_TOOLS: '0',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'WorkspacePolicyWs', plan: 'enterprise' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'workspace-policy@test.com',
      passwordHash,
      name: 'Workspace Policy',
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
      payload: { email: 'workspace-policy@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('enables auto-bind when workspace policy forces it on even if env default is off', async () => {
    const headers = await authHeaders();
    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled' },
    });
    expect(policyPut.statusCode).toBe(200);
    const policyBody = JSON.parse(policyPut.body) as {
      data: { autoBindEnabled: boolean; autoBindMode: string; source: string };
    };
    expect(policyBody.data.autoBindEnabled).toBe(true);
    expect(policyBody.data.autoBindMode).toBe('enabled');
    expect(policyBody.data.source).toBe('workspace_enabled');

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos usar CRM com bind automatico ativado no workspace, mesmo sem flag global.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${planId}/execute`,
      headers,
      payload: { operationId: 'op-workspace-policy-enabled-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const body = JSON.parse(execute.body) as {
      meta: {
        autoBindEnabled?: boolean;
        autoBindMode?: string;
        autoBindPolicySource?: string;
        boundToolDefinitionIds?: string[];
      };
    };
    expect(body.meta.autoBindEnabled).toBe(true);
    expect(body.meta.autoBindMode).toBe('enabled');
    expect(body.meta.autoBindPolicySource).toBe('workspace_enabled');
    expect(body.meta.boundToolDefinitionIds?.length).toBeGreaterThan(0);
  });

  it('returns bind preview with per-agent impact before execute', async () => {
    const headers = await authHeaders();
    const existingAgent = await AgentModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: 'Especialista CRM Reutilizado',
      description: 'Especialista existente para preview.',
      role: 'specialist',
      origin: 'company',
      skills: ['dados'],
      version: '1.0.0',
      category: 'atendimento',
      channels: [],
      status: 'active',
      goal: 'Cadastrar partes',
      responsibilities: ['CRM'],
      capabilities: { tools: [], customToolDefinitionIds: [] },
    });

    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled', reusedAgentBindMode: 'merge' },
    });
    expect(policyPut.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos revisar o impacto do bind em um especialista CRM reutilizado antes da execução.',
      },
    });
    expect(create.statusCode).toBe(201);
    const createdPlan = (JSON.parse(create.body) as {
      data: {
        id: string;
        team: { name: string; objective: string; description: string; channelIds: string[] };
        agents: Array<Record<string, unknown>>;
        graph: { nodes: unknown[]; edges: unknown[] };
      };
    }).data;

    const patchedAgents = createdPlan.agents.map((agent, index) => ({
      ...agent,
      planningMode: index === 1 ? 'existing' : 'new',
      existingAgentId: index === 1 ? existingAgent._id.toString() : null,
      overlapScore: 0,
      overlapReason: '',
      ...(index === 1 ? { name: 'Especialista CRM Reutilizado' } : {}),
    }));

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}`,
      headers,
      payload: {
        team: createdPlan.team,
        agents: patchedAgents,
        graph: createdPlan.graph,
      },
    });
    expect(update.statusCode).toBe(200);

    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/team-plans/${createdPlan.id}/bind-preview`,
      headers,
    });
    expect(preview.statusCode).toBe(200);
    const body = (JSON.parse(preview.body) as {
      data: {
        autoBindEnabled: boolean;
        reusedAgentBindMode: string;
        autoBindActionsRequested: number;
        autoBindActionsApplied: number;
        toolDefinitions: Array<{ actionId: string; currentStatus: string; plannedOperation: string }>;
        agents: Array<{ agentName: string; bindMode: string; targetAgentId?: string; actionIdsToLink: string[] }>;
      };
    }).data;
    expect(body.autoBindEnabled).toBe(true);
    expect(body.reusedAgentBindMode).toBe('merge');
    expect(body.autoBindActionsRequested).toBe(1);
    expect(body.autoBindActionsApplied).toBe(1);
    expect(body.toolDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'crm_create_party',
          currentStatus: 'existing_enabled',
          plannedOperation: 'reuse',
        }),
      ]),
    );
    expect(body.agents.some((agent) => agent.bindMode === 'reused_merge')).toBe(true);
    expect(body.agents.some((agent) => agent.actionIdsToLink.includes('crm_create_party'))).toBe(true);
  });

  it('summarizes bind diff and packs in preview when overrides change the workspace default', async () => {
    const headers = await authHeaders();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockFetchOpenAiSuccess({
        ...MOCK_LLM_PLAN,
        requiredPacks: ['crm'],
        requiredTools: [],
      }),
    );

    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled' },
    });
    expect(policyPut.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos revisar o diff do bind por pack antes da execução final.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const overrides = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${planId}/bind-overrides`,
      headers,
      payload: {
        bindOverrides: {
          agents: {
            coordinator: { mode: 'inherit', excludedActionIds: ['crm_find_party'] },
          },
        },
      },
    });
    expect(overrides.statusCode).toBe(200);

    const body = JSON.parse(overrides.body) as {
      data: {
        preview: {
          autoBindActionsRequested: number;
          bindOverridesApplied: boolean;
          suggestedPacks: Array<{
            packId: string;
            actionIds: string[];
            defaultSelectedActionIds: string[];
            selectedActionIds: string[];
            actionIdsAddedByOverride: string[];
            actionIdsRemovedByOverride: string[];
          }>;
          diffSummary: {
            affectedAgentCount: number;
            addedActionCount: number;
            removedActionCount: number;
          };
          agents: Array<{
            planAgentKey: string;
            defaultActionIdsToLink: string[];
            actionIdsToLink: string[];
            actionIdsRemovedByOverride: string[];
          }>;
        };
      };
    };

    expect(body.data.preview.autoBindActionsRequested).toBe(4);
    expect(body.data.preview.bindOverridesApplied).toBe(true);
    expect(body.data.preview.diffSummary).toEqual({
      affectedAgentCount: 1,
      addedActionCount: 0,
      removedActionCount: 1,
    });
    expect(body.data.preview.suggestedPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'crm',
          actionIds: expect.arrayContaining(['crm_create_party', 'crm_find_party']),
          defaultSelectedActionIds: expect.arrayContaining(['crm_find_party']),
          selectedActionIds: expect.arrayContaining(['crm_find_party']),
          actionIdsAddedByOverride: [],
          actionIdsRemovedByOverride: ['crm_find_party'],
        }),
      ]),
    );
    expect(body.data.preview.agents.find((agent) => agent.planAgentKey === 'coordinator')).toEqual(
      expect.objectContaining({
        defaultActionIdsToLink: expect.arrayContaining(['crm_find_party']),
        actionIdsToLink: expect.not.arrayContaining(['crm_find_party']),
        actionIdsRemovedByOverride: ['crm_find_party'],
      }),
    );
  });

  it('merges suggested tool definitions into reused agents when policy is merge', async () => {
    const headers = await authHeaders();
    const specialistName = 'Especialista CRM Reutilizado Merge';
    const existingAgent = await AgentModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: specialistName,
      description: 'Especialista existente para ser reutilizado no teste de merge.',
      role: 'specialist',
      origin: 'company',
      skills: ['dados-merge'],
      version: '1.0.0',
      category: 'atendimento',
      channels: [],
      status: 'active',
      goal: 'Cadastrar partes com merge controlado',
      responsibilities: ['CRM merge'],
      capabilities: { tools: [], customToolDefinitionIds: [] },
    });

    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled', reusedAgentBindMode: 'merge' },
    });
    expect(policyPut.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos reutilizar um especialista CRM existente e ainda aplicar as tools sugeridas.',
      },
    });
    expect(create.statusCode).toBe(201);
    const createdPlan = (JSON.parse(create.body) as {
      data: {
        id: string;
        team: { name: string; objective: string; description: string; channelIds: string[] };
        agents: Array<Record<string, unknown>>;
        graph: { nodes: unknown[]; edges: unknown[] };
      };
    }).data;

    const patchedAgents = createdPlan.agents.map((agent, index) => ({
      ...agent,
      ...(index === 0
        ? {
            name: 'Coord CRM Merge Exclusivo',
            description: 'Coordena apenas o fluxo de merge deste teste.',
            objective: 'Coordenar bind com merge controlado.',
            responsibilities: ['Coord Merge Exclusivo'],
            skills: ['orquestracao-merge'],
          }
        : {}),
      planningMode: index === 1 ? 'existing' : 'new',
      existingAgentId: index === 1 ? existingAgent._id.toString() : null,
      overlapScore: 0,
      overlapReason: '',
      ...(index === 1
        ? {
            name: specialistName,
            description: 'Especialista existente para ser reutilizado no teste de merge.',
            objective: 'Cadastrar partes com merge controlado',
            responsibilities: ['CRM merge'],
            skills: ['dados-merge'],
          }
        : {}),
    }));

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}`,
      headers,
      payload: {
        team: createdPlan.team,
        agents: patchedAgents,
        graph: createdPlan.graph,
      },
    });
    expect(update.statusCode).toBe(200);

    const overlapFlags = await app.inject({
      method: 'PUT',
      url: '/api/v1/governance/feature-flags',
      headers,
      payload: { overlapMode: 'warning' },
    });
    expect(overlapFlags.statusCode).toBe(200);

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${createdPlan.id}/execute`,
      headers,
      payload: { operationId: 'op-workspace-policy-reused-merge-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const body = JSON.parse(execute.body) as {
      meta: {
        autoBindEnabled?: boolean;
        reusedAgentBindMode?: string;
        reusedAgentsUpdated?: number;
        reusedAgentsSkipped?: number;
        boundToolDefinitionIds?: string[];
      };
      data: {
        result?: {
          createdAgents?: Array<{ id: string; reused?: boolean }>;
        };
      };
    };
    expect(body.meta.autoBindEnabled).toBe(true);
    expect(body.meta.reusedAgentBindMode).toBe('merge');
    expect(body.meta.reusedAgentsUpdated).toBe(1);
    expect(body.meta.reusedAgentsSkipped).toBe(0);
    expect(body.meta.boundToolDefinitionIds?.length).toBeGreaterThan(0);

    const reusedAgentId =
      body.data.result?.createdAgents?.find((row) => row.reused)?.id ?? existingAgent._id.toString();

    const agentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${reusedAgentId}`,
      headers,
    });
    expect(agentRes.statusCode).toBe(200);
    const agent = (JSON.parse(agentRes.body) as { data: { capabilities?: { customToolDefinitionIds?: string[] } } })
      .data;
    const custom = agent.capabilities?.customToolDefinitionIds ?? [];
    for (const id of body.meta.boundToolDefinitionIds ?? []) {
      expect(custom).toContain(id);
    }
  });

  it('persists granular bind overrides and removes non-approved actionIds before execute', async () => {
    const headers = await authHeaders();
    const specialistName = 'Especialista CRM Override Disable';
    const existingAgent = await AgentModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: specialistName,
      description: 'Especialista existente para override granular.',
      role: 'specialist',
      origin: 'company',
      skills: ['dados-override-disable'],
      version: '1.0.0',
      category: 'atendimento',
      channels: [],
      status: 'active',
      goal: 'Cadastrar partes com override desligado',
      responsibilities: ['CRM override disable'],
      capabilities: { tools: [], customToolDefinitionIds: [] },
    });

    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled', reusedAgentBindMode: 'merge' },
    });
    expect(policyPut.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos revisar overrides granulares antes do execute final do bind.',
      },
    });
    expect(create.statusCode).toBe(201);
    const createdPlan = (JSON.parse(create.body) as {
      data: {
        id: string;
        team: { name: string; objective: string; description: string; channelIds: string[] };
        agents: Array<Record<string, unknown>>;
        graph: { nodes: unknown[]; edges: unknown[] };
      };
    }).data;

    const patchedAgents = createdPlan.agents.map((agent, index) => ({
      ...agent,
      ...(index === 0
        ? {
            name: 'Coord CRM Override Disable',
            description: 'Coordena o cenário de override desligado.',
            objective: 'Coordenar revisão granular antes do execute.',
            responsibilities: ['Coord Override Disable'],
            skills: ['orquestracao-override-disable'],
          }
        : {}),
      planningMode: index === 1 ? 'existing' : 'new',
      existingAgentId: index === 1 ? existingAgent._id.toString() : null,
      overlapScore: 0,
      overlapReason: '',
      ...(index === 1
        ? {
            name: specialistName,
            description: 'Especialista existente para override granular.',
            objective: 'Cadastrar partes com override desligado',
            responsibilities: ['CRM override disable'],
            skills: ['dados-override-disable'],
          }
        : {}),
    }));

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}`,
      headers,
      payload: {
        team: createdPlan.team,
        agents: patchedAgents,
        graph: createdPlan.graph,
      },
    });
    expect(update.statusCode).toBe(200);

    const overlapFlags = await app.inject({
      method: 'PUT',
      url: '/api/v1/governance/feature-flags',
      headers,
      payload: { overlapMode: 'warning' },
    });
    expect(overlapFlags.statusCode).toBe(200);

    const overrides = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}/bind-overrides`,
      headers,
      payload: {
        bindOverrides: {
          agents: {
            coordinator: { mode: 'inherit', excludedActionIds: ['crm_create_party'] },
            'specialist-1': { mode: 'disabled', excludedActionIds: [] },
          },
        },
      },
    });
    expect(overrides.statusCode).toBe(200);
    const overridesBody = JSON.parse(overrides.body) as {
      data: {
        plan: { bindOverrides?: { agents?: Record<string, { mode: string; excludedActionIds: string[] }> } };
        preview: {
          effectiveBindEnabled: boolean;
          autoBindActionsApplied: number;
          bindOverridesApplied: boolean;
          bindOverrideAgentCount: number;
          bindOverrideActionCount: number;
          toolDefinitions: Array<{ actionId: string; plannedOperation: string }>;
        };
      };
    };
    expect(overridesBody.data.plan.bindOverrides?.agents?.coordinator?.excludedActionIds).toEqual(['crm_create_party']);
    expect(overridesBody.data.preview.effectiveBindEnabled).toBe(true);
    expect(overridesBody.data.preview.autoBindActionsApplied).toBe(0);
    expect(overridesBody.data.preview.bindOverridesApplied).toBe(true);
    expect(overridesBody.data.preview.bindOverrideAgentCount).toBe(1);
    expect(overridesBody.data.preview.bindOverrideActionCount).toBe(1);
    expect(
      overridesBody.data.preview.toolDefinitions.find((definition) => definition.actionId === 'crm_create_party')
        ?.plannedOperation,
    ).toBe('none');

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${createdPlan.id}/execute`,
      headers,
      payload: { operationId: 'op-workspace-policy-granular-disable-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const executeBody = JSON.parse(execute.body) as {
      meta: {
        effectiveBindEnabled?: boolean;
        bindOverridesApplied?: boolean;
        autoBindActionsApplied?: number;
        bindOverrideAgentCount?: number;
        bindOverrideActionCount?: number;
        bindDiffSummary?: {
          affectedAgentCount: number;
          addedActionCount: number;
          removedActionCount: number;
        };
        boundToolDefinitionIds?: string[];
        reusedAgentsSkipped?: number;
      };
    };
    expect(executeBody.meta.effectiveBindEnabled).toBe(true);
    expect(executeBody.meta.bindOverridesApplied).toBe(true);
    expect(executeBody.meta.autoBindActionsApplied).toBe(0);
    expect(executeBody.meta.bindOverrideAgentCount).toBe(1);
    expect(executeBody.meta.bindOverrideActionCount).toBe(1);
    expect(executeBody.meta.bindDiffSummary).toEqual({
      affectedAgentCount: 2,
      addedActionCount: 0,
      removedActionCount: 2,
    });
    expect(executeBody.meta.boundToolDefinitionIds ?? []).toHaveLength(0);
    expect(executeBody.meta.reusedAgentsSkipped).toBe(1);
  });

  it('allows forcing bind on a reused agent via granular override even when workspace default is manual', async () => {
    const headers = await authHeaders();
    const specialistName = 'Especialista CRM Override Enable';
    const existingAgent = await AgentModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: specialistName,
      description: 'Especialista existente para override enabled.',
      role: 'specialist',
      origin: 'company',
      skills: ['dados-override-enable'],
      version: '1.0.0',
      category: 'atendimento',
      channels: [],
      status: 'active',
      goal: 'Cadastrar partes com override enabled',
      responsibilities: ['CRM override enable'],
      capabilities: { tools: [], customToolDefinitionIds: [] },
    });

    const policyPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/workspace/team-planning-policy',
      headers,
      payload: { autoBindMode: 'enabled', reusedAgentBindMode: 'manual' },
    });
    expect(policyPut.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos forçar bind apenas para um agente reutilizado específico.',
      },
    });
    expect(create.statusCode).toBe(201);
    const createdPlan = (JSON.parse(create.body) as {
      data: {
        id: string;
        team: { name: string; objective: string; description: string; channelIds: string[] };
        agents: Array<Record<string, unknown>>;
        graph: { nodes: unknown[]; edges: unknown[] };
      };
    }).data;

    const patchedAgents = createdPlan.agents.map((agent, index) => ({
      ...agent,
      ...(index === 0
        ? {
            name: 'Coord CRM Override Enable',
            description: 'Coordena o cenário de override enabled.',
            objective: 'Coordenar bind forçado para reused.',
            responsibilities: ['Coord Override Enable'],
            skills: ['orquestracao-override-enable'],
          }
        : {}),
      planningMode: index === 1 ? 'existing' : 'new',
      existingAgentId: index === 1 ? existingAgent._id.toString() : null,
      overlapScore: 0,
      overlapReason: '',
      ...(index === 1
        ? {
            name: specialistName,
            description: 'Especialista existente para override enabled.',
            objective: 'Cadastrar partes com override enabled',
            responsibilities: ['CRM override enable'],
            skills: ['dados-override-enable'],
          }
        : {}),
    }));

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}`,
      headers,
      payload: {
        team: createdPlan.team,
        agents: patchedAgents,
        graph: createdPlan.graph,
      },
    });
    expect(update.statusCode).toBe(200);

    const overlapFlags = await app.inject({
      method: 'PUT',
      url: '/api/v1/governance/feature-flags',
      headers,
      payload: { overlapMode: 'warning' },
    });
    expect(overlapFlags.statusCode).toBe(200);

    const overrides = await app.inject({
      method: 'PUT',
      url: `/api/v1/team-plans/${createdPlan.id}/bind-overrides`,
      headers,
      payload: {
        bindOverrides: {
          agents: {
            'specialist-1': { mode: 'enabled', excludedActionIds: [] },
          },
        },
      },
    });
    expect(overrides.statusCode).toBe(200);
    const overridesBody = JSON.parse(overrides.body) as {
      data: {
        preview: {
          effectiveBindEnabled: boolean;
          bindOverridesApplied: boolean;
          agents: Array<{ planAgentKey: string; bindMode: string; overrideMode: string; actionIdsToLink: string[] }>;
        };
      };
    };
    expect(overridesBody.data.preview.effectiveBindEnabled).toBe(true);
    expect(overridesBody.data.preview.bindOverridesApplied).toBe(true);
    expect(
      overridesBody.data.preview.agents.find((agent) => agent.planAgentKey === 'specialist-1'),
    ).toEqual(
      expect.objectContaining({
        bindMode: 'reused_merge',
        overrideMode: 'enabled',
      }),
    );

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${createdPlan.id}/execute`,
      headers,
      payload: { operationId: 'op-workspace-policy-granular-enable-0001' },
    });
    expect(execute.statusCode).toBe(200);
    const executeBody = JSON.parse(execute.body) as {
      meta: {
        effectiveBindEnabled?: boolean;
        bindOverridesApplied?: boolean;
        reusedAgentsUpdated?: number;
        boundToolDefinitionIds?: string[];
      };
      data: {
        result?: {
          createdAgents?: Array<{ id: string; reused?: boolean }>;
        };
      };
    };
    expect(executeBody.meta.effectiveBindEnabled).toBe(true);
    expect(executeBody.meta.bindOverridesApplied).toBe(true);
    expect(executeBody.meta.reusedAgentsUpdated).toBe(1);
    expect(executeBody.meta.boundToolDefinitionIds?.length).toBeGreaterThan(0);

    const reusedAgentId =
      executeBody.data.result?.createdAgents?.find((row) => row.reused)?.id ?? existingAgent._id.toString();
    const agentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${reusedAgentId}`,
      headers,
    });
    expect(agentRes.statusCode).toBe(200);
    const agent = (JSON.parse(agentRes.body) as { data: { capabilities?: { customToolDefinitionIds?: string[] } } })
      .data;
    const custom = agent.capabilities?.customToolDefinitionIds ?? [];
    for (const id of executeBody.meta.boundToolDefinitionIds ?? []) {
      expect(custom).toContain(id);
    }
  });
});

describe('team-plan Loop 51: reativar definitions inativas no bind', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3004,
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
    const ws = await WorkspaceModel.create({ name: 'Loop51Ws', plan: 'enterprise' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'loop51-autobind@test.com',
      passwordHash,
      name: 'Loop51 AutoBind',
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
      payload: { email: 'loop51-autobind@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('execute reativa definitions inativas selecionadas e expoe reactivatedToolDefinitionIds no meta', async () => {
    const unique = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    jest.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchOpenAiSuccess({
        ...MOCK_LLM_PLAN,
        agents: [
          { ...MOCK_LLM_PLAN.agents[0], name: `Coord ${unique}` },
          { ...MOCK_LLM_PLAN.agents[1], name: `Espec ${unique}` },
        ],
      }),
    );
    const headers = await authHeaders();
    const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
    await WorkspaceToolDefinitionModel.deleteMany({ workspaceId: wsObjectId, slug: 'ba-crm-create-party' });
    const disabled = await WorkspaceToolDefinitionModel.create({
      workspaceId: wsObjectId,
      name: 'Negocio: crm_create_party',
      slug: 'ba-crm-create-party',
      kind: 'internal_action',
      jsonSchema: { type: 'object', additionalProperties: true },
      config: { actionId: 'crm_create_party' },
      enabled: false,
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: `Precisamos cadastrar e consultar clientes com CRM integrado ao time. ${unique}`,
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${planId}/execute`,
      headers,
      payload: { operationId: `op-reativar-def-${unique}` },
    });
    expect(execute.statusCode).toBe(200);
    const body = JSON.parse(execute.body) as {
      meta: { reactivatedToolDefinitionIds?: string[]; boundToolDefinitionIds?: string[] };
    };
    expect(body.meta.reactivatedToolDefinitionIds).toEqual([disabled._id.toString()]);
    expect(body.meta.boundToolDefinitionIds?.length).toBeGreaterThan(0);

    const refreshed = await WorkspaceToolDefinitionModel.findOne({ _id: disabled._id }).lean();
    expect(refreshed && 'enabled' in refreshed && refreshed.enabled).toBe(true);
  });

  it('bind-preview marca reativacao e POST bind-enable-definitions reativa sem sair do fluxo', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchOpenAiSuccess({
        ...MOCK_LLM_PLAN,
        agents: [
          { ...MOCK_LLM_PLAN.agents[0], name: 'Coord Loop51 Reativar A' },
          { ...MOCK_LLM_PLAN.agents[1], name: 'Espec Loop51 Reativar A' },
        ],
      }),
    );
    const headers = await authHeaders();
    const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
    await WorkspaceToolDefinitionModel.deleteMany({ workspaceId: wsObjectId, slug: 'ba-crm-create-party' });
    const disabled = await WorkspaceToolDefinitionModel.create({
      workspaceId: wsObjectId,
      name: 'Negocio: crm_create_party',
      slug: 'ba-crm-create-party',
      kind: 'internal_action',
      jsonSchema: { type: 'object', additionalProperties: true },
      config: { actionId: 'crm_create_party' },
      enabled: false,
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/team-plans',
      headers,
      payload: {
        problem: 'Precisamos cadastrar e consultar clientes com CRM integrado ao time.',
      },
    });
    expect(create.statusCode).toBe(201);
    const planId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/v1/team-plans/${planId}/bind-preview`,
      headers,
    });
    expect(previewRes.statusCode).toBe(200);
    const previewBody = JSON.parse(previewRes.body) as {
      data: {
        toolDefinitions: Array<{
          actionId: string;
          currentStatus: string;
          plannedOperation: string;
          toolDefinitionId?: string;
        }>;
      };
    };
    const crmDef = previewBody.data.toolDefinitions.find((d) => d.actionId === 'crm_create_party');
    expect(crmDef?.currentStatus).toBe('existing_disabled');
    expect(crmDef?.toolDefinitionId).toBe(disabled._id.toString());
    expect(crmDef?.plannedOperation).toBe('reactivate');

    const enable = await app.inject({
      method: 'POST',
      url: `/api/v1/team-plans/${planId}/bind-enable-definitions`,
      headers,
      payload: { actionIds: ['crm_create_party'] },
    });
    expect(enable.statusCode).toBe(200);
    const enableBody = JSON.parse(enable.body) as {
      data: {
        preview: { toolDefinitions: Array<{ actionId: string; currentStatus: string; plannedOperation: string }> };
        reactivatedToolDefinitionIds: string[];
      };
    };
    expect(enableBody.data.reactivatedToolDefinitionIds).toContain(disabled._id.toString());
    const crmAfter = enableBody.data.preview.toolDefinitions.find((d) => d.actionId === 'crm_create_party');
    expect(crmAfter?.currentStatus).toBe('existing_enabled');
    expect(crmAfter?.plannedOperation).toBe('reuse');
  });
});
