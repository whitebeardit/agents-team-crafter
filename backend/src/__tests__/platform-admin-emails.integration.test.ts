import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';

describe('PLATFORM_ADMIN_EMAILS fallback', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let listedUserId: string;
  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    platformAdminEmails: new Set(['listed@test.com']),
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);
    const passwordHash = await bcrypt.hash('secret', 10);
    const u = await UserModel.create({
      email: 'listed@test.com',
      passwordHash,
      name: 'Listed',
      workspaceIds: [],
    });
    listedUserId = u._id.toString();
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('login returns isPlatformAdmin true when email is in PLATFORM_ADMIN_EMAILS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'listed@test.com', password: 'secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { user: { isPlatformAdmin: boolean } };
    };
    expect(body.success).toBe(true);
    expect(body.data.user.isPlatformAdmin).toBe(true);
  });

  it('GET /auth/me returns isPlatformAdmin true', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'listed@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${data.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { isPlatformAdmin: boolean } };
    expect(body.data.isPlatformAdmin).toBe(true);
  });

  it('JWT with isPlatformAdmin false still authorizes POST /workspaces when email is listed', async () => {
    const stale = jwt.sign(
      {
        sub: listedUserId,
        email: 'listed@test.com',
        name: 'Listed',
        isPlatformAdmin: false,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${stale}` },
      payload: { name: 'WsFromStaleJwt' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { success: boolean; data: { name: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('WsFromStaleJwt');
  });
});
