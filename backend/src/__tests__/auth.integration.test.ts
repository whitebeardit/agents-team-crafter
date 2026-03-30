import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';

describe('auth + tenant', () => {
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
  };

  beforeAll(async () => {
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
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('register creates user and returns token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'new@test.com', password: 'password1', name: 'New User' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { token: string; user: { email: string } };
    };
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.email).toBe('new@test.com');
  });

  it('register fails with duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'new@test.com', password: 'password1', name: 'Dup' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('login fails with bad password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('login success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: { token: string } };
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
  });

  it('me with token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${data.token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('tenant 403 without membership', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const fakeWs = '507f1f77bcf86cd799439011';
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: {
        authorization: `Bearer ${data.token}`,
        'x-workspace-id': fakeWs,
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
