import { Types } from 'mongoose';
import type { IWorkspaceRecord, IWorkspaceRepository } from '../domain/ports/workspace-repository.port.js';
import { WorkspaceMemberModel } from './workspace-member.model.js';
import { WorkspaceModel } from './workspace.model.js';
import type { WorkspaceDoc } from './workspace.model.js';
import type { IEncryptedPayload } from '../../../utils/secrets-crypto.js';

function toRec(doc: WorkspaceDoc): IWorkspaceRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    logo: doc.logo != null ? doc.logo : undefined,
    plan: doc.plan as IWorkspaceRecord['plan'],
    settings: (doc.settings as Record<string, unknown>) ?? {},
    limits: (doc.limits as Record<string, unknown>) ?? {},
    createdAt: doc.createdAt!,
    updatedAt: doc.updatedAt!,
  };
}

export class WorkspaceRepository implements IWorkspaceRepository {
  async findById(workspaceId: string): Promise<IWorkspaceRecord | null> {
    const doc = await WorkspaceModel.findById(workspaceId);
    return doc ? toRec(doc as WorkspaceDoc) : null;
  }

  async listByUserId(userId: string): Promise<IWorkspaceRecord[]> {
    const members = await WorkspaceMemberModel.find({ userId: new Types.ObjectId(userId) }).lean();
    const ids = members.map((m) => m.workspaceId);
    if (ids.length === 0) return [];
    const docs = await WorkspaceModel.find({ _id: { $in: ids } }).sort({ name: 1 });
    return docs.map((d) => toRec(d as WorkspaceDoc));
  }

  async listAll(): Promise<IWorkspaceRecord[]> {
    const docs = await WorkspaceModel.find({}).sort({ name: 1 });
    return docs.map((d) => toRec(d as WorkspaceDoc));
  }

  async createWorkspace(input: {
    name: string;
    logo?: string;
    plan?: IWorkspaceRecord['plan'];
  }): Promise<IWorkspaceRecord> {
    const doc = await WorkspaceModel.create({
      name: input.name.trim(),
      logo: input.logo,
      plan: input.plan ?? 'free',
      settings: {},
      limits: {},
    });
    return toRec(doc as WorkspaceDoc);
  }

  async findByIdForUser(workspaceId: string, userId: string): Promise<IWorkspaceRecord | null> {
    const m = await WorkspaceMemberModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
    });
    if (!m) return null;
    const doc = await WorkspaceModel.findById(workspaceId);
    return doc ? toRec(doc as WorkspaceDoc) : null;
  }

  async updateWorkspace(
    workspaceId: string,
    patch: Partial<Pick<IWorkspaceRecord, 'name' | 'logo' | 'settings'>>,
  ): Promise<IWorkspaceRecord | null> {
    const doc = await WorkspaceModel.findByIdAndUpdate(
      workspaceId,
      { $set: patch },
      { new: true },
    );
    return doc ? toRec(doc as WorkspaceDoc) : null;
  }

  async updateWorkspacePlanAndLimits(
    workspaceId: string,
    input: { plan: IWorkspaceRecord['plan']; limits: Record<string, unknown> },
  ): Promise<IWorkspaceRecord | null> {
    const doc = await WorkspaceModel.findByIdAndUpdate(
      workspaceId,
      { $set: { plan: input.plan, limits: input.limits } },
      { new: true },
    );
    return doc ? toRec(doc as WorkspaceDoc) : null;
  }

  async getIntegrationSecretsEncrypted(workspaceId: string): Promise<IEncryptedPayload | undefined> {
    const doc = await WorkspaceModel.findById(workspaceId).select('integrationSecretsEncrypted').lean();
    if (!doc) return undefined;
    const enc = (doc as { integrationSecretsEncrypted?: IEncryptedPayload }).integrationSecretsEncrypted;
    return enc?.ciphertext ? enc : undefined;
  }

  async setIntegrationSecretsEncrypted(
    workspaceId: string,
    enc: IEncryptedPayload | null,
  ): Promise<boolean> {
    if (enc) {
      const res = await WorkspaceModel.findByIdAndUpdate(workspaceId, {
        $set: { integrationSecretsEncrypted: enc },
      });
      return !!res;
    }
    const res = await WorkspaceModel.findByIdAndUpdate(workspaceId, {
      $unset: { integrationSecretsEncrypted: 1 },
    });
    return !!res;
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const res = await WorkspaceModel.deleteOne({ _id: new Types.ObjectId(workspaceId) });
    return res.deletedCount === 1;
  }
}
