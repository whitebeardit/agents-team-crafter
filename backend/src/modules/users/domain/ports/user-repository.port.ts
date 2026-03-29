import type { Types } from 'mongoose';

export interface IUserRecord {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
  passwordHash: string;
  workspaceIds: string[];
  refreshTokenHash?: string | null;
}

export interface IUserRepository {
  create(input: { email: string; passwordHash: string; name: string }): Promise<IUserRecord>;
  findByEmail(email: string): Promise<IUserRecord | null>;
  findById(id: string): Promise<IUserRecord | null>;
  findByRefreshTokenHash(hash: string): Promise<IUserRecord | null>;
  updateRefreshToken(id: string, hash: string | null): Promise<void>;
  syncWorkspaceIds(userId: string, workspaceIds: Types.ObjectId[]): Promise<void>;
  updateProfile(
    id: string,
    patch: { name?: string; preferences?: Record<string, unknown>; avatar?: string },
  ): Promise<void>;
}
