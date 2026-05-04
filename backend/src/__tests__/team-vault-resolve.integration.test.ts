import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { VaultNoteIndexModel } from '../modules/team-vault/infra/vault-note-index.model.js';

jest.setTimeout(60_000);

describe('GET /vault/notes/:noteId/resolve', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let workspaceId = '';
  const agentId = '507f1f77bcf86cd799439011';
  const partyId = '507f1f77bcf86cd799439022';

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
    const ws = await WorkspaceModel.create({ name: 'VaultResolveWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'vault-resolve@test.com',
      passwordHash,
      name: 'Vault User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    await VaultNoteIndexModel.create({
      workspaceId: ws._id,
      agentId,
      noteId: 'note-agent-only',
      notePath: `agents/${agentId}/learnings/note-agent-only.md`,
      status: 'active',
      kind: 'fact',
      tags: [],
      confidence: 0.5,
      tokens: 5,
      version: 1,
      contentHash: 'hash1',
      title: 'A',
      bodyPreview: 'B',
    });

    await VaultNoteIndexModel.create({
      workspaceId: ws._id,
      agentId,
      partyId,
      partySlug: 'cliente-x',
      noteId: 'note-party',
      notePath: `parties/${partyId}/note-party.md`,
      status: 'proposed',
      kind: 'preference',
      tags: [],
      confidence: 0.4,
      tokens: 5,
      version: 1,
      contentHash: 'hash2',
      title: 'P',
      bodyPreview: 'Q',
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
      payload: { email: 'vault-resolve@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('resolve nota apenas de agente devolve webPath /agents/...', async () => {
    if (!app) throw new Error('app not ready');
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vault/notes/note-agent-only/resolve',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { webPath: string; agentId: string; partyId?: string; status: string };
    };
    expect(body.data.webPath).toContain(`/agents/${agentId}`);
    expect(body.data.webPath).toContain('vaultTab=vault');
    expect(body.data.webPath).toContain('vaultNote=');
    expect(body.data.agentId).toBe(agentId);
    expect(body.data.partyId).toBeUndefined();
    expect(body.data.status).toBe('active');
  });

  it('resolve nota em party devolve webPath para settings', async () => {
    if (!app) throw new Error('app not ready');
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vault/notes/note-party/resolve',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { webPath: string; status: string } };
    expect(body.data.webPath).toContain('/settings?tab=workspace');
    expect(body.data.webPath).toContain(encodeURIComponent('note-party'));
    expect(body.data.status).toBe('proposed');
  });
});
