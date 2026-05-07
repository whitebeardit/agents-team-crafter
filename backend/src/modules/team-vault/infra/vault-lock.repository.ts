import { Types } from 'mongoose';
import { VaultLockModel } from './vault-lock.model.js';

const DEFAULT_TTL_MS = 30_000;

export class VaultLockRepository {
  async acquire(workspaceId: string, holder: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
    const wid = new Types.ObjectId(workspaceId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const updated = await VaultLockModel.findOneAndUpdate(
      { workspaceId: wid, $or: [{ expiresAt: { $lte: now } }, { holder }] },
      { $set: { holder, expiresAt } },
      { new: true },
    );
    if (updated) return true;
    try {
      await VaultLockModel.create({ workspaceId: wid, holder, expiresAt });
      return true;
    } catch {
      return false;
    }
  }

  async release(workspaceId: string, holder: string): Promise<void> {
    await VaultLockModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      holder,
    });
  }

  async pruneExpired(): Promise<void> {
    await VaultLockModel.deleteMany({ expiresAt: { $lte: new Date() } });
  }
}
