import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';
import { OpenAIAgentsRuntimeProvider } from '../modules/runtime/infra/openai-agents-runtime.provider.js';

jest.setTimeout(60_000);

describe('runs persistence endpoints', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let teamId = '';

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
    const ws = await WorkspaceModel.create({ name: 'RunsWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'runs@test.com',
      passwordHash,
      name: 'Runs',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    const specialist = await AgentModel.create({
      workspaceId: ws._id,
      name: 'Especialista',
      description: 'Executa tarefas.',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      capabilities: {},
    });
    const coordinator = await AgentModel.create({
      workspaceId: ws._id,
      name: 'Coordenador',
      description: 'Coordena.',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      capabilities: {},
    });
    const team = await TeamModel.create({
      workspaceId: ws._id,
      name: 'Time Runs',
      description: '',
      status: 'active',
      coordinatorId: coordinator._id,
      agentIds: [specialist._id],
      channelIds: [],
    });
    teamId = team._id.toString();

    app = await buildApp(env);
  });

  afterAll(async () => {
    if (app) await app.close();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  async function authHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'runs@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('persists manual run and exposes it via team runs endpoint', async () => {
    const headers = await authHeaders();
    const run = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers,
      payload: { message: 'validar nota', channel: 'debug' },
    });
    expect(run.statusCode).toBe(200);
    const runData = (JSON.parse(run.body) as { data: { runId: string } }).data;

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/runs`,
      headers,
    });
    expect(list.statusCode).toBe(200);
    const runs = (JSON.parse(list.body) as { data: Array<{ runId: string }> }).data;
    expect(runs.some((item) => item.runId === runData.runId)).toBe(true);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runData.runId}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
  });

  it('persists NO_PROGRESS_DETECTED interruption and exposes metadata via /runs and /runs/:id/events', async () => {
    const headers = await authHeaders();
    const coordinatorSpy = jest
      .spyOn(OpenAIAgentsRuntimeProvider.prototype, 'runCoordinatorTurn')
      .mockResolvedValueOnce({
        finalOutput: 'Falha repetida sem progresso.',
        events: [
          {
            type: 'toolResult',
            tool: 'ws_crm_upsert',
            status: 'error',
            errorCode: 'EXECUTION_ERROR',
            detail: 'timeout',
          },
          {
            type: 'toolResult',
            tool: 'ws_crm_upsert',
            status: 'error',
            errorCode: 'EXECUTION_ERROR',
            detail: 'timeout',
          },
        ],
      });

    const runResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers,
      payload: { message: 'investigue a repetição de timeout na ws_crm_upsert', taskType: 'invoice_validation' },
    });
    coordinatorSpy.mockRestore();

    expect(runResponse.statusCode).toBe(200);
    const runBody = JSON.parse(runResponse.body) as {
      data: {
        runId: string;
        events?: Array<{
          type?: string;
          interrupted?: boolean;
          interruptReasonCode?: string;
          interruptPolicy?: string;
        }>;
      };
    };
    const runId = runBody.data.runId;
    const interruptedFromRun = runBody.data.events?.find((e) => e.type === 'executionInterrupted');
    expect(interruptedFromRun?.interrupted).toBe(true);
    expect(interruptedFromRun?.interruptReasonCode).toBe('NO_PROGRESS_DETECTED');
    expect(interruptedFromRun?.interruptPolicy).toBe('NO_PROGRESS_GUARD');

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/runs?status=interrupted&limit=20`,
      headers,
    });
    expect(list.statusCode).toBe(200);
    const listBody = JSON.parse(list.body) as {
      data: Array<{
        runId: string;
        status: string;
        interrupt?: { interruptReasonCode?: string; interruptPolicy?: string; interrupted?: boolean };
      }>;
    };
    const listed = listBody.data.find((item) => item.runId === runId);
    expect(listed).toBeDefined();
    expect(listed?.status).toBe('interrupted');
    expect(listed?.interrupt?.interrupted).toBe(true);
    expect(listed?.interrupt?.interruptReasonCode).toBe('NO_PROGRESS_DETECTED');
    expect(listed?.interrupt?.interruptPolicy).toBe('NO_PROGRESS_GUARD');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runId}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    const detailBody = JSON.parse(detail.body) as {
      data: {
        status: string;
        interrupt?: {
          interruptReasonCode?: string;
          interruptReasonMessage?: string;
          interruptReasonDetail?: string;
          nextStep?: string;
          progressState?: string;
        };
      };
    };
    expect(detailBody.data.status).toBe('interrupted');
    expect(detailBody.data.interrupt?.interruptReasonCode).toBe('NO_PROGRESS_DETECTED');
    expect(detailBody.data.interrupt?.interruptReasonMessage).toMatch(/falta de progresso/i);
    expect(detailBody.data.interrupt?.interruptReasonDetail).toMatch(/sem progresso/i);
    expect(detailBody.data.interrupt?.progressState).toBe('tool_error_repeated');
    expect(detailBody.data.interrupt?.nextStep).toBeDefined();

    const events = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runId}/events`,
      headers,
    });
    expect(events.statusCode).toBe(200);
    const eventsBody = JSON.parse(events.body) as {
      data: Array<{
        type?: string;
        payload?: { interruptReasonCode?: string; interrupted?: boolean; interruptPolicy?: string };
      }>;
    };
    const interruptedEvent = eventsBody.data.find((e) => e.type === 'executionInterrupted');
    expect(interruptedEvent?.payload?.interrupted).toBe(true);
    expect(interruptedEvent?.payload?.interruptReasonCode).toBe('NO_PROGRESS_DETECTED');
    expect(interruptedEvent?.payload?.interruptPolicy).toBe('NO_PROGRESS_GUARD');
  });
});
