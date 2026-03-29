import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { InviteModel } from '../modules/workspaces/infra/invite.model.js';

describe('workspace invites list revoke accept', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId: string;
  let ownerToken: string;
  let inviteeToken: string;
  let inviteId: string;

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    RUNTIME_MAX_HANDOFF_DEPTH: 4,
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);
    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'W', plan: 'free' });
    workspaceId = ws._id.toString();
    const owner = await UserModel.create({
      email: 'owner@test.com',
      passwordHash,
      name: 'Owner',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: owner._id,
      role: 'owner',
    });
    await UserModel.create({
      email: 'invitee@test.com',
      passwordHash,
      name: 'Invitee',
      workspaceIds: [],
    });
    app = await buildApp(env);

    const loginOwner = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'owner@test.com', password: 'secret' },
    });
    ownerToken = (JSON.parse(loginOwner.body) as { data: { token: string } }).data.token;

    const loginInvitee = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'invitee@test.com', password: 'secret' },
    });
    inviteeToken = (JSON.parse(loginInvitee.body) as { data: { token: string } }).data.token;
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('POST invite then GET lists it', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/members/invite`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'invitee@test.com', role: 'member' },
    });
    expect(post.statusCode).toBe(201);
    const created = JSON.parse(post.body) as { data: { inviteId: string } };
    inviteId = created.data.inviteId;

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      data: Array<{ inviteId: string; email: string; revokedAt?: string }>;
    };
    expect(body.data.some((i) => i.inviteId === inviteId)).toBe(true);
  });

  it('accept works before revoke', async () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const doc = await InviteModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      email: 'other@test.com',
      role: 'member',
      expiresAt: expires,
    });
    const oid = doc._id.toString();
    await UserModel.create({
      email: 'other@test.com',
      passwordHash: await bcrypt.hash('secret', 10),
      name: 'Other',
      workspaceIds: [],
    });
    const loginOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'other@test.com', password: 'secret' },
    });
    const tok = (JSON.parse(loginOther.body) as { data: { token: string } }).data.token;
    const acc = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/invites/${oid}/accept`,
      headers: { authorization: `Bearer ${tok}` },
      payload: {},
    });
    expect(acc.statusCode).toBe(200);
  });

  it('POST revoke invalidates invite then accept fails', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/members/invite`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'invitee@test.com', role: 'admin' },
    });
    expect(post.statusCode).toBe(201);
    const nid = (JSON.parse(post.body) as { data: { inviteId: string } }).data.inviteId;

    const rev = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/invites/${nid}/revoke`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(rev.statusCode).toBe(200);

    const acc = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/invites/${nid}/accept`,
      headers: { authorization: `Bearer ${inviteeToken}` },
      payload: {},
    });
    expect(acc.statusCode).toBe(400);
  });

  it('DELETE removes invite permanently; accept returns 404', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/members/invite`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'invitee@test.com', role: 'member' },
    });
    expect(post.statusCode).toBe(201);
    const pid = (JSON.parse(post.body) as { data: { inviteId: string } }).data.inviteId;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}/invites/${pid}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const body = JSON.parse(list.body) as { data: Array<{ inviteId: string }> };
    expect(body.data.some((i) => i.inviteId === pid)).toBe(false);

    const acc = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/invites/${pid}/accept`,
      headers: { authorization: `Bearer ${inviteeToken}` },
      payload: {},
    });
    expect(acc.statusCode).toBe(404);
  });

  it('GET invites 403 for member without admin/owner', async () => {
    const member = await UserModel.create({
      email: 'memberonly@test.com',
      passwordHash: await bcrypt.hash('secret', 10),
      name: 'Mem',
      workspaceIds: [new mongoose.Types.ObjectId(workspaceId)],
    });
    await WorkspaceMemberModel.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: member._id,
      role: 'member',
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'memberonly@test.com', password: 'secret' },
    });
    const tok = (JSON.parse(login.body) as { data: { token: string } }).data.token;
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/invites`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(list.statusCode).toBe(403);
  });
});
