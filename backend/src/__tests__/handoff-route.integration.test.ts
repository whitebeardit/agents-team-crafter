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

describe('PUT /agents/:id/handoff e regras mistas', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let agentAId = '';
  let agentBId = '';

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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'HandoffWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const u = await UserModel.create({
      email: 'handoff@test.com',
      passwordHash,
      name: 'User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    const agentB = await AgentModel.create({
      workspaceId: ws._id,
      name: 'HB',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'B',
      capabilities: { canReceiveHandoff: true },
    });
    agentBId = agentB._id.toString();

    const agentA = await AgentModel.create({
      workspaceId: ws._id,
      name: 'HA',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'A',
      capabilities: { canDelegate: true },
      handoff: {
        targets: [agentBId],
        rules: [`route:taskType:invoice_validation->agent:${agentBId}`],
      },
    });
    agentAId = agentA._id.toString();

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
      payload: { email: 'handoff@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('aceita rules mistas (preset + JSON) e persiste', async () => {
    const validJsonRule = {
      id: 'rule-int',
      version: 0,
      when: { all: [{ path: 'taskType', op: 'eq', value: 'invoice_validation' }] },
      then: [{ kind: 'route', targetAgentId: agentBId }],
    };
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/agents/${agentAId}/handoff`,
      headers,
      payload: {
        targets: [agentBId],
        rules: [`route:taskType:x->agent:${agentBId}`, validJsonRule],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: { rules: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.rules).toHaveLength(2);
    expect(body.data.rules[1]).toMatchObject({ id: 'rule-int', version: 0 });
  });

  it('retorna VALIDATION_ERROR ao receber regra JSON invalida', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/agents/${agentAId}/handoff`,
      headers,
      payload: {
        targets: [agentBId],
        rules: [{ when: { all: [] } }],
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
