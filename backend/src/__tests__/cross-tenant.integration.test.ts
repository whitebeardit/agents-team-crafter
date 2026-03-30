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

describe('cross-tenant isolation', () => {
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
    OPENAI_API_KEY: undefined,
    ENCRYPTION_MASTER_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  let wsAId = '';
  let wsBId = '';
  let agentAOnlyId = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const wsA = await WorkspaceModel.create({ name: 'WA', plan: 'free' });
    const wsB = await WorkspaceModel.create({ name: 'WB', plan: 'free' });
    wsAId = wsA._id.toString();
    wsBId = wsB._id.toString();

    const u = await UserModel.create({
      email: 'multi@test.com',
      passwordHash,
      name: 'Multi',
      workspaceIds: [wsA._id, wsB._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: wsA._id,
      userId: u._id,
      role: 'owner',
    });
    await WorkspaceMemberModel.create({
      workspaceId: wsB._id,
      userId: u._id,
      role: 'owner',
    });

    const agent = await AgentModel.create({
      workspaceId: wsA._id,
      name: 'OnlyA',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
    });
    agentAOnlyId = agent._id.toString();

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function token() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'multi@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('returns 404 when accessing agent from another workspace', async () => {
    const t = await token();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentAOnlyId}`,
      headers: {
        authorization: `Bearer ${t}`,
        'x-workspace-id': wsBId,
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns agent when workspace header matches', async () => {
    const t = await token();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentAOnlyId}`,
      headers: {
        authorization: `Bearer ${t}`,
        'x-workspace-id': wsAId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(agentAOnlyId);
  });
});
