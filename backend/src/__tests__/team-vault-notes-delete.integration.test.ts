import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Types } from 'mongoose';
import { buildApp } from '../app/app.js';
import { loadEnv } from '../config/env.js';
import { createDeps } from '../config/container.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';

jest.setTimeout(60_000);

describe('DELETE /vault/notes/:noteId', () => {
  let mongo: MongoMemoryServer;
  let tmpDir: string;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let workspaceId = '';
  let prevMongo: string | undefined;
  let prevVault: string | undefined;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vault-notes-del-'));
    prevMongo = process.env.MONGODB_URI;
    prevVault = process.env.VAULT_ROOT;
    process.env.MONGODB_URI = mongo.getUri();
    process.env.VAULT_ROOT = tmpDir;
    process.env.JWT_SECRET = '01234567890123456789012345678901';
    process.env.NODE_ENV = 'test';
    await mongoose.connect(mongo.getUri());

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'VaultNotesDeleteWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'vault-notes-delete@test.com',
      passwordHash,
      name: 'Vault User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    const env = loadEnv();
    app = await buildApp(env);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await mongoose.disconnect();
    await mongo.stop();
    if (prevMongo !== undefined) process.env.MONGODB_URI = prevMongo;
    else delete process.env.MONGODB_URI;
    if (prevVault !== undefined) process.env.VAULT_ROOT = prevVault;
    else delete process.env.VAULT_ROOT;
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function authHeaders() {
    if (!app) throw new Error('app not ready');
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'vault-notes-delete@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('remove nota do indice e do disco', async () => {
    if (!app) throw new Error('app not ready');
    const env = loadEnv();
    const deps = createDeps(env);
    const agentId = new Types.ObjectId().toString();
    const { noteId } = await deps.vaultWriter.proposeNote({
      workspaceId,
      agentId,
      kind: 'preference',
      title: 'procedimento de teste',
      body: 'Conteudo de teste para delete.',
      createdBy: 'librarian',
    });
    const row = await deps.vaultNoteIndexRepo.findByNoteId(workspaceId, noteId);
    expect(row).not.toBeNull();

    const headers = await authHeaders();
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/vault/notes/${encodeURIComponent(noteId)}`,
      headers,
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/vault/notes?limit=50',
      headers,
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { data: Array<{ noteId: string }> };
    expect(body.data.some((r) => r.noteId === noteId)).toBe(false);

    const del2 = await app.inject({
      method: 'DELETE',
      url: `/api/v1/vault/notes/${encodeURIComponent(noteId)}`,
      headers,
    });
    expect(del2.statusCode).toBe(404);
  });
});
