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

describe('POST /teams/:id/run (team runtime)', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let teamId = '';
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
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
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

    const agentB = await AgentModel.create({
      workspaceId: ws._id,
      name: 'B',
      description: 'specialist',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente B',
      capabilities: {},
    });
    const agentA = await AgentModel.create({
      workspaceId: ws._id,
      name: 'A',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente coordenador',
      capabilities: {},
    });
    coordId = agentA._id.toString();

    const team = await TeamModel.create({
      workspaceId: ws._id,
      name: 'T1',
      description: '',
      status: 'active',
      coordinatorId: agentA._id,
      agentIds: [agentB._id],
      channelIds: [],
    });
    teamId = team._id.toString();

    env.OPENAI_API_KEY = undefined;
    process.env.OPENAI_API_KEY = '';

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function loginAndGetToken() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('executes team with coordinator as sole top-level agent (no handoff chain in API)', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: { message: 'validar nota', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data.coordinatorAgentId).toBe(coordId);
    expect(body.data.teamId).toBe(teamId);
    expect((body.data.externalResponse as { text?: string })?.text).toBeDefined();
    expect(body.data).not.toHaveProperty('handoffs');
    expect(body.data).not.toHaveProperty('selectedAgentId');
    expect(Array.isArray(body.data.specialistResults)).toBe(true);
  });
});
