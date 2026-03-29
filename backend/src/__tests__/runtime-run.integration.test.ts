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

describe('runtime run endpoint', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    RUNTIME_MAX_HANDOFF_DEPTH: 4,
  };

  beforeAll(async () => {
    // Garante isolamento entre suites (mongoose eh singleton e pode manter estado entre testes).
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'W', plan: 'free' });
    const u = await UserModel.create({
      email: 'u@test.com',
      passwordHash,
      name: 'User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    // Two agents, with deterministic handoff from A -> B on taskType
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
      capabilities: { canReceiveHandoff: true },
    });
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
        targets: [agentB._id.toString()],
        rules: [`route:taskType:invoice_validation->agent:${agentB._id.toString()}`],
      },
    });

    // Evita chamada real ao provedor externo (IEnv + process).
    env.OPENAI_API_KEY = undefined;
    process.env.OPENAI_API_KEY = '';

    app = await buildApp(env);
    void agentA;
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function loginAndGetToken() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('routes to handoff target deterministically by taskType', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const agentA = await AgentModel.findOne({ name: 'A' }).lean();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${String((agentA as { _id: unknown })._id)}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as any)._id),
      },
      payload: { message: 'validar nota', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: any };
    expect(body.success).toBe(true);
    expect(body.data.decision.kind).toBe('handoff');
    expect(body.data.selectedAgentId).not.toBe(body.data.agentId);
    expect(Array.isArray(body.data.handoffs)).toBe(true);
    expect(body.data.handoffs).toHaveLength(1);
    expect(body.data.orchestrationDepth).toBe(1);
    expect(body.data.events.some((e: { type: string }) => e.type === 'handoff')).toBe(true);
  });
});

