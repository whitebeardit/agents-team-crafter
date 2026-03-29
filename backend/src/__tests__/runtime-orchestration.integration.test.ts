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

const CHAIN_TASK = 'chain_test';

describe('runtime orquestracao multi-hop e RUNTIME_MAX_HANDOFF_DEPTH', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let coordId = '';
  let bId = '';
  let cId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: undefined,
    RUNTIME_MAX_HANDOFF_DEPTH: 4,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'OrchWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const u = await UserModel.create({
      email: 'orch@test.com',
      passwordHash,
      name: 'User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    const agentC = await AgentModel.create({
      workspaceId: ws._id,
      name: 'C',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente C',
      capabilities: { canReceiveHandoff: true },
    });
    cId = agentC._id.toString();

    const agentB = await AgentModel.create({
      workspaceId: ws._id,
      name: 'B',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente B',
      capabilities: { canDelegate: true, canReceiveHandoff: true },
      handoff: {
        targets: [cId],
        rules: [`route:taskType:${CHAIN_TASK}->agent:${cId}`],
      },
    });
    bId = agentB._id.toString();

    const agentA = await AgentModel.create({
      workspaceId: ws._id,
      name: 'A',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente A',
      capabilities: { canDelegate: true },
      handoff: {
        targets: [bId],
        rules: [`route:taskType:${CHAIN_TASK}->agent:${bId}`],
      },
    });
    coordId = agentA._id.toString();

    process.env.OPENAI_API_KEY = '';
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function loginAndHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'orch@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('encadeia dois handoffs A->B->C e executa no agente final', async () => {
    const headers = await loginAndHeaders();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${coordId}/run`,
      headers,
      payload: { message: 'fluxo cadeia', taskType: CHAIN_TASK },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    const d = body.data;
    expect(d.selectedAgentId).toBe(cId);
    expect(d.orchestrationDepth).toBe(2);
    expect(Array.isArray(d.handoffs)).toBe(true);
    expect((d.handoffs as unknown[]).length).toBe(2);
  });
});
