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

describe('DELETE /channels/:id (admin, conflito com times)', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let coordId = '';
  let ownerEmail = 'ch-del-owner@test.com';
  let memberEmail = 'ch-del-member@test.com';

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
    const ws = await WorkspaceModel.create({ name: 'ChDelWs', plan: 'free' });
    workspaceId = ws._id.toString();

    const owner = await UserModel.create({
      email: ownerEmail,
      passwordHash,
      name: 'Owner',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: owner._id,
      role: 'owner',
    });

    const member = await UserModel.create({
      email: memberEmail,
      passwordHash,
      name: 'Member',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: member._id,
      role: 'member',
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

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders(email: string) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('remove canal sem vínculo a time (admin)', async () => {
    const headers = await authHeaders(ownerEmail);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers,
      payload: {
        type: 'api',
        name: 'Canal orphan',
        config: {},
      },
    });
    expect(create.statusCode).toBe(201);
    const channelId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/channels/${channelId}`,
      headers,
    });
    expect(del.statusCode).toBe(200);
    const body = JSON.parse(del.body) as { success: boolean; data: { message: string } };
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('removido');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/channels',
      headers,
    });
    const listData = JSON.parse(list.body) as { data: Array<{ id: string }> };
    expect(listData.data.some((c) => c.id === channelId)).toBe(false);
  });

  it('409 quando canal está em channelIds de um time', async () => {
    const headers = await authHeaders(ownerEmail);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers,
      payload: {
        type: 'slack',
        name: 'Slack bound',
        config: { slackTeamId: 'T_X' },
      },
    });
    expect(create.statusCode).toBe(201);
    const channelId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const team = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers,
      payload: {
        name: 'Team With Channel',
        coordinatorId: coordId,
        channelIds: [channelId],
        agentIds: [],
      },
    });
    expect(team.statusCode).toBe(201);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/channels/${channelId}`,
      headers,
    });
    expect(del.statusCode).toBe(409);
    const err = JSON.parse(del.body) as {
      success: boolean;
      error: { code: string; details: { teams: Array<{ id: string; name: string }> } };
    };
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('CONFLICT');
    expect(Array.isArray(err.error.details.teams)).toBe(true);
    expect(err.error.details.teams.length).toBeGreaterThanOrEqual(1);
    expect(err.error.details.teams[0].name).toBe('Team With Channel');
  });

  it('403 quando usuário não é admin', async () => {
    const ownerHeaders = await authHeaders(ownerEmail);
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers: ownerHeaders,
      payload: {
        type: 'email',
        name: 'Email orphan',
        config: {},
      },
    });
    expect(create.statusCode).toBe(201);
    const channelId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    const memberHeaders = await authHeaders(memberEmail);
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/channels/${channelId}`,
      headers: memberHeaders,
    });
    expect(del.statusCode).toBe(403);
  });
});
