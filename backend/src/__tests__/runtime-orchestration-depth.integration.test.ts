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

const T = 'depth_chain';

describe('RUNTIME_MAX_HANDOFF_DEPTH bloqueia cadeia longa', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let coordId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: undefined,
    RUNTIME_MAX_HANDOFF_DEPTH: 2,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'DepthWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const u = await UserModel.create({
      email: 'depth@test.com',
      passwordHash,
      name: 'User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    const d = await AgentModel.create({
      workspaceId: ws._id,
      name: 'D',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'D',
      capabilities: { canReceiveHandoff: true },
    });
    const dId = d._id.toString();

    const c = await AgentModel.create({
      workspaceId: ws._id,
      name: 'C',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'C',
      capabilities: { canDelegate: true, canReceiveHandoff: true },
      handoff: {
        targets: [dId],
        rules: [`route:taskType:${T}->agent:${dId}`],
      },
    });
    const cId = c._id.toString();

    const b = await AgentModel.create({
      workspaceId: ws._id,
      name: 'B',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'B',
      capabilities: { canDelegate: true, canReceiveHandoff: true },
      handoff: {
        targets: [cId],
        rules: [`route:taskType:${T}->agent:${cId}`],
      },
    });
    const bId = b._id.toString();

    const a = await AgentModel.create({
      workspaceId: ws._id,
      name: 'A',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'Geral',
      channels: [],
      status: 'active',
      systemInstruction: 'A',
      capabilities: { canDelegate: true },
      handoff: {
        targets: [bId],
        rules: [`route:taskType:${T}->agent:${bId}`],
      },
    });
    coordId = a._id.toString();

    process.env.OPENAI_API_KEY = '';
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('retorna 400 quando o terceiro handoff excede o limite', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'depth@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    const headers = {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${coordId}/run`,
      headers,
      payload: { message: 'cadeia longa', taskType: T },
    });

    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body) as { success: boolean; error?: { code?: string; message?: string } };
    expect(err.success).toBe(false);
    expect(err.error?.code).toBe('HANDOFF_BLOCKED');
    expect(String(err.error?.message ?? '')).toMatch(/limite de orquestracao|RUNTIME_MAX_HANDOFF_DEPTH/i);
  });
});
