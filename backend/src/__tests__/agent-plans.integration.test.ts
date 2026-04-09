import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';

describe('agent plans flow', () => {
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
    OPENAI_API_KEY: undefined,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'AgentPlanWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'agent-plan@test.com',
      passwordHash,
      name: 'Agent Planner',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    await AgentModel.create({
      workspaceId: ws._id,
      name: 'Especialista Fiscal',
      description: 'Valida documentos fiscais e XMLs de entrada.',
      role: 'specialist',
      origin: 'company',
      skills: ['validacao fiscal', 'xml', 'triagem'],
      version: '1.0.0',
      category: 'fiscal',
      channels: [],
      status: 'active',
      goal: 'Revisar XML fiscal',
      responsibilities: ['Validar XML fiscal', 'Apontar inconsistencias'],
      domain: {
        summary: 'Validacao de documentos fiscais',
        keywords: ['fiscal', 'xml', 'validacao'],
        boundaries: ['Validar XML fiscal'],
        exclusions: ['Atendimento'],
      },
    });

    app = await buildApp(env);
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
      payload: { email: 'agent-plan@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('creates, updates and executes an agent plan', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-plans',
      headers,
      payload: {
        objective: 'Criar um especialista para classificar chamados financeiros sem fazer atendimento.',
        context: 'Entradas vindas do ERP com dados de cobrança.',
        expectedOutcome: 'Classificação do chamado e próximos passos.',
        category: 'financeiro',
        skills: ['classificacao', 'financeiro'],
        boundaries: ['Classificar chamados financeiros'],
        exclusions: ['Atendimento ao cliente'],
      },
    });
    expect(create.statusCode).toBe(201);
    const created = (JSON.parse(create.body) as { data: { id: string; decision: string } }).data;
    expect(created.id).toBeTruthy();

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/agent-plans/${created.id}`,
      headers,
      payload: {
        draftAgent: {
          name: 'Especialista Financeiro',
          role: 'specialist',
          description: 'Classifica chamados financeiros.',
          category: 'financeiro',
          skills: ['classificacao', 'financeiro'],
          goal: 'Classificar chamados',
          responsibilities: ['Classificar chamados financeiros'],
          domain: {
            summary: 'Classificação de chamados financeiros',
            boundaries: ['Classificar chamados financeiros'],
            exclusions: ['Atendimento ao cliente'],
          },
        },
      },
    });
    expect(update.statusCode).toBe(200);

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-plans/${created.id}/execute`,
      headers,
    });
    expect(execute.statusCode).toBe(200);
    const executed = (JSON.parse(execute.body) as { data: { result?: { createdAgentId?: string } } }).data;
    expect(executed.result?.createdAgentId).toBeTruthy();
  });

  it('executes blocked agent plan with overlap warning and returns governance meta', async () => {
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
      url: '/api/v1/agent-plans',
      headers,
      payload: {
        objective: 'Criar um especialista fiscal.',
        context: 'Entradas vindas do ERP.',
        expectedOutcome: 'Validar XML fiscal.',
        category: 'fiscal',
        skills: ['validacao fiscal', 'xml'],
        boundaries: ['Validar XML fiscal'],
        exclusions: ['Atendimento'],
      },
    });
    expect(create.statusCode).toBe(201);
    const created = (JSON.parse(create.body) as { data: { id: string; decision: string } }).data;

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/agent-plans/${created.id}`,
      headers,
      payload: {
        draftAgent: {
          name: 'Validador Fiscal',
          description: 'Valida XML fiscal de entrada.',
          role: 'specialist',
          category: 'fiscal',
          skills: ['validacao fiscal', 'xml'],
          goal: 'Revisar XML fiscal',
          responsibilities: ['Validar XML fiscal'],
          domain: {
            summary: 'Validacao de documentos fiscais',
            keywords: ['fiscal', 'xml', 'validacao'],
            boundaries: ['Validar XML fiscal'],
            exclusions: ['Atendimento'],
          },
        },
      },
    });
    expect(update.statusCode).toBe(200);
    const updated = (JSON.parse(update.body) as { data: { id: string; decision: string } }).data;
    expect(updated.decision).toBe('blocked');

    const execute = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-plans/${updated.id}/execute`,
      headers,
    });
    expect(execute.statusCode).toBe(200);
    const envelope = JSON.parse(execute.body) as {
      data: { result?: { createdAgentId?: string } };
      meta: { governanceWarning?: { decision: string } };
    };
    expect(envelope.data.result?.createdAgentId).toBeTruthy();
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
