import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { VaultLockRepository } from './vault-lock.repository.js';

jest.setTimeout(60_000);

describe('VaultLockRepository', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('allows only one holder per workspace until release or expiry path', async () => {
    const repo = new VaultLockRepository();
    const ws = new Types.ObjectId().toString();
    expect(await repo.acquire(ws, 'holder-a', 10_000)).toBe(true);
    expect(await repo.acquire(ws, 'holder-b', 10_000)).toBe(false);
    await repo.release(ws, 'holder-a');
    expect(await repo.acquire(ws, 'holder-b', 10_000)).toBe(true);
  });
});
