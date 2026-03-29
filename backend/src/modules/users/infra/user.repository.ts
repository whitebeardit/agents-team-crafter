import type { IUserRecord, IUserRepository } from '../domain/ports/user-repository.port.js';
import { UserModel } from './user.model.js';

function toRecord(doc: InstanceType<typeof UserModel>): IUserRecord {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    avatar: doc.avatar,
    preferences: (doc.preferences as Record<string, unknown> | undefined) ?? {},
    passwordHash: doc.passwordHash,
    workspaceIds: (doc.workspaceIds ?? []).map((x: { toString: () => string }) => x.toString()),
    refreshTokenHash: doc.refreshTokenHash,
  };
}

export class UserRepository implements IUserRepository {
  async create(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<IUserRecord> {
    const doc = await UserModel.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name.trim(),
      workspaceIds: [],
    });
    return toRecord(doc);
  }

  async findByEmail(email: string): Promise<IUserRecord | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<IUserRecord | null> {
    const doc = await UserModel.findById(id);
    return doc ? toRecord(doc) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<IUserRecord | null> {
    const doc = await UserModel.findOne({ refreshTokenHash: hash });
    return doc ? toRecord(doc) : null;
  }

  async updateRefreshToken(id: string, hash: string | null): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $set: { refreshTokenHash: hash } });
  }

  async syncWorkspaceIds(userId: string, workspaceIds: import('mongoose').Types.ObjectId[]): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { $set: { workspaceIds } });
  }

  async updateProfile(
    id: string,
    patch: { name?: string; preferences?: Record<string, unknown>; avatar?: string },
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $set: patch });
  }
}
