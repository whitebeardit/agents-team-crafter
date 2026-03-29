import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiKeyModel } from './api-key.model.js';
import type { ApiKeyDoc } from './api-key.model.js';

function hashKey(plain: string) {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

function generatePlainKey() {
  return `sk-teamagents-${randomBytes(24).toString('hex')}`;
}

export class ApiKeyRepository {
  async list(workspaceId: string) {
    const docs = await ApiKeyModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => {
      const x = d as ApiKeyDoc;
      return {
        id: x._id.toString(),
        name: x.name,
        prefix: x.prefix,
        lastUsed: x.lastUsedAt?.toISOString(),
        createdAt: x.createdAt?.toISOString(),
      };
    });
  }

  async create(workspaceId: string, name: string) {
    const plain = generatePlainKey();
    const prefix = `${plain.slice(0, 22)}…`;
    const doc = await ApiKeyModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name,
      prefix,
      hashedKey: hashKey(plain),
    });
    const x = doc as ApiKeyDoc;
    return {
      id: x._id.toString(),
      name: x.name,
      key: plain,
      createdAt: x.createdAt?.toISOString(),
    };
  }

  async delete(workspaceId: string, id: string) {
    const r = await ApiKeyModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return r.deletedCount === 1;
  }

  async regenerate(workspaceId: string, id: string) {
    const plain = generatePlainKey();
    const prefix = `${plain.slice(0, 22)}…`;
    const doc = await ApiKeyModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { hashedKey: hashKey(plain), prefix } },
      { new: true },
    ).exec();
    if (!doc) return null;
    const x = doc as ApiKeyDoc;
    return {
      id: x._id.toString(),
      name: x.name,
      key: plain,
      regeneratedAt: new Date().toISOString(),
    };
  }
}
