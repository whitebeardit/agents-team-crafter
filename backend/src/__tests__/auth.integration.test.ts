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
    const me = JSON.parse(res.body) as {
      data: { preferences?: Record<string, unknown>; email: string };
    };
    expect(me.data.email).toBe('u@test.com');
    expect(me.data.preferences).toEqual({});
  });

  it('GET /settings/profile and PUT preferences + avatar data URL', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/profile',
      headers: { authorization: `Bearer ${data.token}` },
      payload: {
        name: 'User',
        avatar: tinyPng,
        preferences: { locale: 'en-US', theme: 'light', bio: 'Hello' },
      },
    });
    expect(put.statusCode).toBe(200);
    const putBody = JSON.parse(put.body) as {
      data: { avatar?: string; preferences: { locale?: string; theme?: string; bio?: string } };
    };
    expect(putBody.data.avatar).toBe(tinyPng);
    expect(putBody.data.preferences.locale).toBe('en-US');
    expect(putBody.data.preferences.theme).toBe('light');
    expect(putBody.data.preferences.bio).toBe('Hello');

    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/profile',
      headers: { authorization: `Bearer ${data.token}` },
    });
    expect(get.statusCode).toBe(200);
    const getBody = JSON.parse(get.body) as { data: { preferences: { bio?: string } } };
    expect(getBody.data.preferences.bio).toBe('Hello');

    const me2 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${data.token}` },
    });
    const meParsed = JSON.parse(me2.body) as {
      data: { preferences: { locale?: string }; avatar?: string };
    };
    expect(meParsed.data.preferences.locale).toBe('en-US');
    expect(meParsed.data.avatar).toBe(tinyPng);
  });

  it('PUT /settings/profile clears avatar with empty string', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/profile',
      headers: { authorization: `Bearer ${data.token}` },
      payload: { avatar: tinyPng },
    });
    const clear = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/profile',
      headers: { authorization: `Bearer ${data.token}` },
      payload: { avatar: '' },
    });
    expect(clear.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${data.token}` },
    });
    const meParsed = JSON.parse(me.body) as { data: { avatar?: string } };
    expect(meParsed.data.avatar).toBeUndefined();
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
