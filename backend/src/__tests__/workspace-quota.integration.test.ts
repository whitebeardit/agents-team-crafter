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
import { TeamModel } from '../modules/teams/infra/team.model.js';
import { ChannelModel } from '../modules/channels/infra/channel.model.js';

describe('workspace quotas (plan limits)', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let coordId = '';
  let channelId = '';

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
    const ws = await WorkspaceModel.create({ name: 'QuotaWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const u = await UserModel.create({
      email: 'quota@test.com',
      passwordHash,
      name: 'Quota User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    const coord = await AgentModel.create({
      workspaceId: ws._id,
      name: 'Coord',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: ['slack'],
      status: 'active',
    });
    coordId = coord._id.toString();

    const ch = await ChannelModel.create({
      workspaceId: ws._id,
      type: 'slack',
      name: 'Slack',
      status: 'connected',
      config: { slackTeamId: 'T_Q' },
    });
    channelId = ch._id.toString();

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
      payload: { email: 'quota@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('GET /settings/workspace reflects free plan limits and usage', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/workspace',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { limits: { maxTeams: number; maxAgents: number; maxChannels: number } };
    };
    expect(body.data.limits.maxTeams).toBe(2);
    expect(body.data.limits.maxAgents).toBe(5);
    expect(body.data.limits.maxChannels).toBe(10);
  });

  it('blocks POST /teams when at team quota (free: 2)', async () => {
    const headers = await authHeaders();
    await TeamModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });

    for (let i = 0; i < 2; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/teams',
        headers,
        payload: {
          name: `Team ${i}`,
          coordinatorId: coordId,
          channelIds: [channelId],
          agentIds: [],
        },
      });
      expect(r.statusCode).toBe(201);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers,
      payload: {
        name: 'Team overflow',
        coordinatorId: coordId,
        channelIds: [channelId],
        agentIds: [],
      },
    });
    expect(blocked.statusCode).toBe(403);
    const err = JSON.parse(blocked.body) as { error?: { code?: string } };
    expect(err.error?.code).toBe('QUOTA_EXCEEDED');
  });

  it('blocks POST /agents when at agent quota (free: 5)', async () => {
    const headers = await authHeaders();
    await AgentModel.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      _id: { $ne: new mongoose.Types.ObjectId(coordId) },
    });
    await TeamModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });

    for (let i = 0; i < 4; i++) {
      await AgentModel.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: `Agent fill ${i}`,
        description: '',
        role: 'specialist',
        origin: 'company',
        version: '1.0.0',
        category: 'geral',
        channels: [],
        status: 'active',
      });
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers,
      payload: {
        name: 'Extra',
        role: 'specialist',
        skills: [],
        qualityCriteria: [],
        systemRole: null,
      },
    });
    expect(blocked.statusCode).toBe(403);
    const err = JSON.parse(blocked.body) as { error?: { code?: string } };
    expect(err.error?.code).toBe('QUOTA_EXCEEDED');
  });

  it('blocks POST /channels when at channel quota (free: 10)', async () => {
    const headers = await authHeaders();
    await ChannelModel.deleteMany({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });

    for (let i = 0; i < 10; i++) {
      await ChannelModel.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        type: 'api',
        name: `Ch ${i}`,
        status: 'connected',
        config: {},
      });
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers,
      payload: { type: 'api', name: 'Overflow', config: {} },
    });
    expect(blocked.statusCode).toBe(403);
    const err = JSON.parse(blocked.body) as { error?: { code?: string } };
    expect(err.error?.code).toBe('QUOTA_EXCEEDED');
  });
});
