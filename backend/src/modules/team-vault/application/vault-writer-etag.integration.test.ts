import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Types } from 'mongoose';
import { loadEnv } from '../../../config/env.js';
import { createDeps } from '../../../config/container.js';
import { WorkspaceModel } from '../../workspaces/infra/workspace.model.js';
describe('VaultWriterService updateNoteContent — lock optimista', () => {
  let mongo: MongoMemoryServer;
  let tmp: string;
  let prevMongo: string | undefined;
  let prevVault: string | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    tmp = await mkdtemp(path.join(os.tmpdir(), 'vault-writer-etag-'));
    prevMongo = process.env.MONGODB_URI;
    prevVault = process.env.VAULT_ROOT;
    process.env.MONGODB_URI = mongo.getUri();
    process.env.VAULT_ROOT = tmp;
    process.env.JWT_SECRET = '01234567890123456789012345678901';
    process.env.NODE_ENV = 'test';
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    if (prevMongo !== undefined) process.env.MONGODB_URI = prevMongo;
    else delete process.env.MONGODB_URI;
    if (prevVault !== undefined) process.env.VAULT_ROOT = prevVault;
    else delete process.env.VAULT_ROOT;
    await rm(tmp, { recursive: true, force: true });
  });

  it('rejeita com 412 quando o hash nao coincide', async () => {
    const ws = await WorkspaceModel.create({ name: 'VaultEtagWs', plan: 'free' });
    const wid = ws._id.toString();
    const agentId = new Types.ObjectId().toString();
    const env = loadEnv();
    const deps = createDeps(env);
    const { noteId } = await deps.vaultWriter.proposeNote({
      workspaceId: wid,
      agentId,
      kind: 'fact',
      title: 'T',
      body: 'body content for etag test',
      createdBy: 'librarian',
    });
    await expect(
      deps.vaultWriter.updateNoteContent({
        workspaceId: wid,
        noteId,
        expectedContentHash: 'intentionally-wrong-hash',
        title: 'T2',
        body: 'x',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', httpStatus: 412 });
  });

  it('aceita quando o hash coincide', async () => {
    const ws = await WorkspaceModel.create({ name: 'VaultEtagWs2', plan: 'free' });
    const wid = ws._id.toString();
    const agentId = new Types.ObjectId().toString();
    const env = loadEnv();
    const deps = createDeps(env);
    const { noteId } = await deps.vaultWriter.proposeNote({
      workspaceId: wid,
      agentId,
      kind: 'fact',
      title: 'Hello',
      body: 'original',
      createdBy: 'librarian',
    });
    const row = await deps.vaultNoteIndexRepo.findByNoteId(wid, noteId);
    expect(row).not.toBeNull();
    const r = await deps.vaultWriter.updateNoteContent({
      workspaceId: wid,
      noteId,
      expectedContentHash: row!.contentHash,
      title: 'Hello',
      body: 'edited line',
    });
    expect(r.version).toBeGreaterThanOrEqual(2);
    expect(r.contentHash.length).toBe(64);
  });
});
