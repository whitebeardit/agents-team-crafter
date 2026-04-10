import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';

describe('observability metrics-summary', () => {
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
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'ObsWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const owner = await UserModel.create({
      email: 'obs-owner@test.com',
      passwordHash,
      name: 'Obs Owner',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: owner._id,
      role: 'owner',
    });

    const memberUser = await UserModel.create({
      email: 'obs-member@test.com',
      passwordHash,
      name: 'Obs Member',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: memberUser._id,
      role: 'member',
    });

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

  it('returns metrics summary for workspace admin', async () => {
    const headers = await authHeaders('obs-owner@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/observability/metrics-summary',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        collectedAt: string;
        kpis: { teamPlanExecute: { total: number } };
        metrics: Array<{ name: string }>;
      };
    };
    expect(body.data.collectedAt).toBeTruthy();
    expect(body.data.kpis).toBeDefined();
    expect(typeof body.data.kpis.teamPlanExecute.total).toBe('number');
    expect(Array.isArray(body.data.metrics)).toBe(true);
    const names = body.data.metrics.map((m) => m.name);
    expect(names.some((n) => n.includes('team_plan'))).toBe(true);
  });

  it('returns 403 for workspace member', async () => {
    const headers = await authHeaders('obs-member@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/observability/metrics-summary',
      headers,
    });
    expect(res.statusCode).toBe(403);
  });
});
