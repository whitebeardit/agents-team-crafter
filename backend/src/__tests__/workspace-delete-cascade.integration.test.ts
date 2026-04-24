import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { InviteModel } from '../modules/workspaces/infra/invite.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';
import { TeamGraphModel } from '../modules/graphs/infra/team-graph.model.js';

describe('workspace delete cascade', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let ownerId = '';
  let memberId = '';

  const ownerEmail = 'owner-delete@test.com';
  const platformAdminEmail = 'platform-admin-delete@test.com';
  const outsiderEmail = 'outsider-delete@test.com';
  const password = 'secret123';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3020,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
    platformAdminEmails: new Set([platformAdminEmail]),
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      WorkspaceModel.deleteMany({}),
      WorkspaceMemberModel.deleteMany({}),
      InviteModel.deleteMany({}),
      AgentModel.deleteMany({}),
      TeamModel.deleteMany({}),
      TeamGraphModel.deleteMany({}),
      UserModel.deleteMany({}),
    ]);

    const hash = await bcrypt.hash(password, 10);
    const workspace = await WorkspaceModel.create({ name: 'Delete Me Workspace', plan: 'free' });
    workspaceId = workspace._id.toString();

    const owner = await UserModel.create({
      email: ownerEmail,
      passwordHash: hash,
      name: 'Owner',
      workspaceIds: [workspace._id],
    });
    ownerId = owner._id.toString();

    const platformAdmin = await UserModel.create({
      email: platformAdminEmail,
      passwordHash: hash,
      name: 'Platform Admin',
      workspaceIds: [workspace._id],
    });
    memberId = platformAdmin._id.toString();

    await UserModel.create({
      email: outsiderEmail,
      passwordHash: hash,
      name: 'Outsider',
      workspaceIds: [],
    });

    await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
    });

    await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId: platformAdmin._id,
      role: 'member',
    });

    await InviteModel.create({
      workspaceId: workspace._id,
      email: 'invitee@test.com',
      role: 'member',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const coordinator = await AgentModel.create({
      workspaceId: workspace._id,
      name: 'Coord',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
    });

    const specialist = await AgentModel.create({
      workspaceId: workspace._id,
      name: 'Specialist',
      description: '',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
    });

    const team = await TeamModel.create({
      workspaceId: workspace._id,
      name: 'Team Delete',
      description: '',
      objective: '',
      status: 'draft',
      coordinatorId: coordinator._id,
      agentIds: [specialist._id],
      channelIds: [],
    });

    await TeamGraphModel.create({
      workspaceId: workspace._id,
      teamId: team._id,
      nodes: [],
      edges: [],
    });
  });

  async function login(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const body = JSON.parse(res.body) as { data: { token: string } };
    return body.data.token;
  }

  it('allows owner to delete workspace and cascades data cleanup', async () => {
    const token = await login(ownerEmail);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId },
    });

    expect(response.statusCode).toBe(200);

    expect(await WorkspaceModel.findById(workspaceId)).toBeNull();
    expect(await TeamModel.countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })).toBe(0);
    expect(await TeamGraphModel.countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })).toBe(0);
    expect(await AgentModel.countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })).toBe(0);
    expect(await InviteModel.countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })).toBe(0);
    expect(await WorkspaceMemberModel.countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })).toBe(0);

    const owner = (await UserModel.findById(ownerId).lean()) as { workspaceIds?: Types.ObjectId[] } | null;
    const platformAdmin = (await UserModel.findById(memberId).lean()) as {
      workspaceIds?: Types.ObjectId[];
    } | null;
    expect((owner?.workspaceIds ?? []).map((id: Types.ObjectId) => String(id))).not.toContain(workspaceId);
    expect((platformAdmin?.workspaceIds ?? []).map((id: Types.ObjectId) => String(id))).not.toContain(workspaceId);
  });

  it('allows platform admin to delete workspace even without workspace admin role', async () => {
    const token = await login(platformAdminEmail);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId },
    });
    expect(response.statusCode).toBe(200);
    expect(await WorkspaceModel.findById(workspaceId)).toBeNull();
  });

  it('blocks deletion for user without permissions', async () => {
    const token = await login(outsiderEmail);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId },
    });
    expect(response.statusCode).toBe(403);
  });
});
