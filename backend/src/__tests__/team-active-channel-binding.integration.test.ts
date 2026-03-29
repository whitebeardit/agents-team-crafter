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
import { ChannelModel } from '../modules/channels/infra/channel.model.js';

describe('binding 1:1 channelId em times ativos', () => {
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
    const ws = await WorkspaceModel.create({ name: 'BindWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const u = await UserModel.create({
      email: 'bind@test.com',
      passwordHash,
      name: 'User',
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
      category: 'Geral',
      channels: ['slack'],
      status: 'active',
    });
    coordId = coord._id.toString();

    const ch = await ChannelModel.create({
      workspaceId: ws._id,
      type: 'slack',
      name: 'Slack',
      status: 'connected',
      config: { slackTeamId: 'T_TEST' },
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
      payload: { email: 'bind@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('rejeita segundo time ativo com o mesmo channelId', async () => {
    const headers = await authHeaders();

    const t1 = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers,
      payload: {
        name: 'Team One',
        coordinatorId: coordId,
        channelIds: [channelId],
        agentIds: [],
      },
    });
    expect(t1.statusCode).toBe(201);
    const t1Id = (JSON.parse(t1.body) as { data: { id: string } }).data.id;

    const act1 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${t1Id}/activate`,
      headers,
    });
    expect(act1.statusCode).toBe(200);

    const t2 = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers,
      payload: {
        name: 'Team Two',
        coordinatorId: coordId,
        channelIds: [channelId],
        agentIds: [],
      },
    });
    expect(t2.statusCode).toBe(201);
    const t2Id = (JSON.parse(t2.body) as { data: { id: string } }).data.id;

    const act2 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${t2Id}/activate`,
      headers,
    });
    expect(act2.statusCode).toBe(400);
    const err = JSON.parse(act2.body) as { success: boolean; error?: { message?: string } };
    expect(err.success).toBe(false);
    expect(String(err.error?.message ?? '')).toContain('time ativo');
  });
});
