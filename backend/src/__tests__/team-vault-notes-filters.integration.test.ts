import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { VaultNoteIndexModel } from '../modules/team-vault/infra/vault-note-index.model.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';

jest.setTimeout(60_000);

describe('GET /vault/notes teamId and agentId filters', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let workspaceId = '';
  let teamId = '';
  const agentA = '507f1f77bcf86cd799439011';
  const agentB = '507f1f77bcf86cd799439012';

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
    const ws = await WorkspaceModel.create({ name: 'VaultNotesFilterWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'vault-notes-filter@test.com',
      passwordHash,
      name: 'Vault User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    const team = await TeamModel.create({
      workspaceId: ws._id,
      name: 'Team Alpha',
      description: '',
      status: 'active',
      coordinatorId: new Types.ObjectId(agentA),
      agentIds: [new Types.ObjectId(agentA), new Types.ObjectId(agentB)],
      channelIds: [],
    });
    teamId = team._id.toString();

    await VaultNoteIndexModel.create({
      workspaceId: ws._id,
      agentId: agentA,
      noteId: 'note-a',
      notePath: `agents/${agentA}/learnings/note-a.md`,
      status: 'active',
      kind: 'fact',
      tags: [],
      confidence: 0.5,
      tokens: 5,
      version: 1,
      contentHash: 'hash-a',
      title: 'Note A',
      bodyPreview: 'A',
    });

    await VaultNoteIndexModel.create({
      workspaceId: ws._id,
      agentId: agentB,
      noteId: 'note-b',
      notePath: `agents/${agentB}/learnings/note-b.md`,
      status: 'active',
      kind: 'fact',
      tags: [],
      confidence: 0.5,
      tokens: 5,
      version: 1,
      contentHash: 'hash-b',
      title: 'Note B',
      bodyPreview: 'B',
    });

    app = await buildApp(env);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders() {
    if (!app) throw new Error('app not ready');
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'vault-notes-filter@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('teamId filtra por agentIds do time', async () => {
    if (!app) throw new Error('app not ready');
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/vault/notes?teamId=${encodeURIComponent(teamId)}&limit=50`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ noteId: string }> };
    const ids = body.data.map((r) => r.noteId).sort();
    expect(ids).toEqual(['note-a', 'note-b']);
  });

  it('agentId prevalece sobre teamId', async () => {
    if (!app) throw new Error('app not ready');
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/vault/notes?teamId=${encodeURIComponent(teamId)}&agentId=${encodeURIComponent(agentB)}&limit=50`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ noteId: string }> };
    expect(body.data.map((r) => r.noteId)).toEqual(['note-b']);
  });

  it('teamId inexistente devolve lista vazia', async () => {
    if (!app) throw new Error('app not ready');
    const headers = await authHeaders();
    const fakeTeam = '507f1f77bcf86cd799439099';
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/vault/notes?teamId=${encodeURIComponent(fakeTeam)}&limit=50`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });
});
