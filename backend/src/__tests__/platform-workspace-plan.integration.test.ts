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

async function createAgent(wsId: mongoose.Types.ObjectId, name: string) {
  return AgentModel.create({
    workspaceId: wsId,
    name,
    description: '',
    role: 'specialist',
    origin: 'company',
    skills: [],
    version: '1.0.0',
    category: 'geral',
    channels: [],
    status: 'active',
  });
}

describe('PATCH /platform/workspaces/:id/plan', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let workspaceOverrideId = '';
  let memberEmail = 'ws-plan-member@test.com';

  const baseEnv: IEnv = {
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
    baseEnv.MONGODB_URI = mongo.getUri();
    await mongoose.connect(baseEnv.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret-secret', 10);
    await UserModel.create({
      email: 'platform-plan-admin@test.com',
      passwordHash,
      name: 'Platform',
      workspaceIds: [],
      isPlatformAdmin: true,
    });
    const member = await UserModel.create({
      email: memberEmail,
      passwordHash,
      name: 'Member',
      workspaceIds: [],
      isPlatformAdmin: false,
    });

    const ws = await WorkspaceModel.create({ name: 'ProWs', plan: 'pro' });
    workspaceId = ws._id.toString();
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: member._id,
      role: 'owner',
    });
    await UserModel.updateOne({ _id: member._id }, { $push: { workspaceIds: ws._id } });

    for (let i = 0; i < 6; i += 1) {
      await createAgent(ws._id, `Agent ${i}`);
    }

    const ws2 = await WorkspaceModel.create({
      name: 'OverrideWs',
      plan: 'free',
      limits: { maxAgents: 50 },
    });
    workspaceOverrideId = ws2._id.toString();
    await createAgent(ws2._id, 'Only one');

    app = await buildApp(baseEnv);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function platformToken() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'platform-plan-admin@test.com', password: 'secret-secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  async function memberToken() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: memberEmail, password: 'secret-secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('returns 409 when downgrade would exceed free agent cap', async () => {
    const token = await platformToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/platform/workspaces/${workspaceId}/plan`,
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'free' },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as {
      success: false;
      error: { code: string; details: { conflicts: Array<{ resource: string; used: number; max: number }> } };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('QUOTA_CONFLICT');
    const agents = body.error.details.conflicts.find((c) => c.resource === 'agents');
    expect(agents).toEqual({ resource: 'agents', used: 6, max: 5 });
  });

  it('allows upgrade to enterprise and clears implicit downgrade issue', async () => {
    const token = await platformToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/platform/workspaces/${workspaceId}/plan`,
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'enterprise' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { plan: string } };
    expect(body.data.plan).toBe('enterprise');
  });

  it('clears maxAgents override when patching plan so defaults apply', async () => {
    const token = await platformToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/platform/workspaces/${workspaceOverrideId}/plan`,
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'free' },
    });
    expect(res.statusCode).toBe(200);
    const raw = await WorkspaceModel.findById(workspaceOverrideId).lean();
    expect((raw as { limits?: Record<string, unknown> }).limits?.maxAgents).toBeUndefined();
  });

  it('member sees free limits (maxAgents 5) after override workspace gets a member', async () => {
    const passwordHash = await bcrypt.hash('solo-secret', 10);
    const solo = await UserModel.create({
      email: 'solo-override@test.com',
      passwordHash,
      name: 'Solo',
      workspaceIds: [],
      isPlatformAdmin: false,
    });
    await WorkspaceMemberModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceOverrideId),
      userId: solo._id,
      role: 'owner',
    });
    await UserModel.updateOne({ _id: solo._id }, { $push: { workspaceIds: workspaceOverrideId } });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'solo-override@test.com', password: 'solo-secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const settingsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/workspace',
      headers: {
        authorization: `Bearer ${data.token}`,
        'x-workspace-id': workspaceOverrideId,
      },
    });
    expect(settingsRes.statusCode).toBe(200);
    const body = JSON.parse(settingsRes.body) as {
      data: { limits: { maxAgents: number; usedAgents: number } };
    };
    expect(body.data.limits.maxAgents).toBe(5);
    expect(body.data.limits.usedAgents).toBe(1);
  });

  it('rejects non-platform admin', async () => {
    const mToken = await memberToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/platform/workspaces/${workspaceId}/plan`,
      headers: { authorization: `Bearer ${mToken}` },
      payload: { plan: 'pro' },
    });
    expect(res.statusCode).toBe(403);
  });
});
