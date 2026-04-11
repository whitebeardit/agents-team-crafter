import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';

describe('platform danger zone factory reset', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;

  const baseEnv: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: undefined,
    DANGER_ZONE_FACTORY_RESET_ENABLED: '1',
    DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION: '0',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    baseEnv.MONGODB_URI = mongo.getUri();
    await mongoose.connect(baseEnv.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret-secret', 10);
    await UserModel.create({
      email: 'platform-admin@test.com',
      passwordHash,
      name: 'Platform',
      workspaceIds: [],
      isPlatformAdmin: true,
    });
    await UserModel.create({
      email: 'member@test.com',
      passwordHash,
      name: 'Member',
      workspaceIds: [],
      isPlatformAdmin: false,
    });

    const ws = await WorkspaceModel.create({ name: 'Ws', plan: 'free' });
    await AgentModel.create({
      workspaceId: ws._id,
      name: 'Bot',
      description: 'x',
      role: 'specialist',
      origin: 'company',
      skills: [],
      version: '1.0.0',
      category: 'x',
      channels: [],
      status: 'active',
    });

    app = await buildApp(baseEnv);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function tokenFor(email: string) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'secret-secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('GET status reflects availability when enabled', async () => {
    const token = await tokenFor('platform-admin@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/danger-zone/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { factoryResetAvailable: boolean; blockedReason: string | null };
    };
    expect(body.data.factoryResetAvailable).toBe(true);
    expect(body.data.blockedReason).toBeNull();
  });

  it('rejects reset when confirmEmail does not match session', async () => {
    const token = await tokenFor('platform-admin@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/danger-zone/factory-reset',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        confirmPhrase: 'RESET_FACTORY_INSTALLATION',
        confirmEmail: 'other@test.com',
        acknowledgeIrreversible: true,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-platform admin', async () => {
    const token = await tokenFor('member@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/danger-zone/factory-reset',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        confirmPhrase: 'RESET_FACTORY_INSTALLATION',
        confirmEmail: 'member@test.com',
        acknowledgeIrreversible: true,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('wipes all collections when confirmation is valid', async () => {
    expect(await UserModel.countDocuments()).toBeGreaterThan(0);
    const token = await tokenFor('platform-admin@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/danger-zone/factory-reset',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        confirmPhrase: 'RESET_FACTORY_INSTALLATION',
        confirmEmail: 'platform-admin@test.com',
        acknowledgeIrreversible: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { totalDeleted: number } };
    expect(body.data.totalDeleted).toBeGreaterThan(0);
    expect(await UserModel.countDocuments()).toBe(0);
    expect(await WorkspaceModel.countDocuments()).toBe(0);
    expect(await AgentModel.countDocuments()).toBe(0);
  });
});

describe('platform factory reset disabled by env', () => {
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
    DANGER_ZONE_FACTORY_RESET_ENABLED: '0',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret2-secret', 10);
    await UserModel.create({
      email: 'admin2@test.com',
      passwordHash,
      name: 'A',
      workspaceIds: [],
      isPlatformAdmin: true,
    });

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('returns 403 on POST when master switch is off', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin2@test.com', password: 'secret2-secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/danger-zone/factory-reset',
      headers: { authorization: `Bearer ${data.token}` },
      payload: {
        confirmPhrase: 'RESET_FACTORY_INSTALLATION',
        confirmEmail: 'admin2@test.com',
        acknowledgeIrreversible: true,
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
