import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';

describe('tool-definitions bulk internal_action', () => {
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
    OPENAI_API_KEY: undefined,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'ToolBulkWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'tool-bulk@test.com',
      passwordHash,
      name: 'Tool Admin',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

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
      payload: { email: 'tool-bulk@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('POST bulk-internal-actions cria varias tools e idempotencia em repeticao', async () => {
    const headers = await authHeaders();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/tool-definitions/bulk-internal-actions',
      headers,
      payload: {
        actionIds: ['business.ping', 'crm_create_party', 'actionId_inexistente_xyz'],
      },
    });
    expect(first.statusCode).toBe(201);
    const body1 = JSON.parse(first.body) as {
      success: boolean;
      data: {
        created: { slug: string; config: Record<string, unknown> }[];
        skipped: { actionId: string; reason: string }[];
        errors: { actionId: string; message: string }[];
      };
    };
    expect(body1.success).toBe(true);
    expect(body1.data.created.length).toBe(2);
    expect(body1.data.skipped.some((s) => s.actionId === 'actionId_inexistente_xyz' && s.reason === 'not_in_catalog')).toBe(
      true,
    );
    expect(body1.data.errors.length).toBe(0);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/tool-definitions/bulk-internal-actions',
      headers,
      payload: {
        actionIds: ['business.ping', 'crm_create_party'],
      },
    });
    expect(second.statusCode).toBe(200);
    const body2 = JSON.parse(second.body) as {
      data: { created: unknown[]; skipped: { actionId: string; reason: string }[] };
    };
    expect(body2.data.created.length).toBe(0);
    expect(body2.data.skipped.length).toBe(2);
    expect(body2.data.skipped.every((s) => s.reason === 'already_defined')).toBe(true);
  });
});
