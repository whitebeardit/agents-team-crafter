import { Types } from 'mongoose';
import { ClinicConversationStateModel } from './clinic-conversation-state.model.js';

export type ClinicConversationState = {
  workspaceId: string;
  teamId: string;
  conversationId: string;
  currentPatient?: {
    partyId: string;
    careSubjectId?: string;
    name: string;
    phone?: string;
  };
  currentPackageSaleId?: string;
  lastAppointmentId?: string;
  lastEncounterId?: string;
  timezone?: string;
  updatedAt: Date;
};

export class ClinicConversationStateRepository {
  async get(workspaceId: string, teamId: string, conversationId: string): Promise<ClinicConversationState | null> {
    const doc = await ClinicConversationStateModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      conversationId: conversationId.trim(),
    })
      .sort({ updatedAt: -1 })
      .lean();
    if (!doc) return null;
    const state = (doc as { state?: Record<string, unknown> }).state ?? {};
    return {
      workspaceId,
      teamId,
      conversationId: conversationId.trim(),
      ...(state as Omit<ClinicConversationState, 'workspaceId' | 'teamId' | 'conversationId' | 'updatedAt'>),
      updatedAt: (doc as { updatedAt?: Date }).updatedAt ?? new Date(),
    };
  }

  async upsert(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    patch: Partial<Omit<ClinicConversationState, 'workspaceId' | 'teamId' | 'conversationId' | 'updatedAt'>>,
  ): Promise<void> {
    const key = conversationId.trim();
    if (!key) return;
    const existing = await this.get(workspaceId, teamId, key);
    const mergedCurrentPatient = patch.currentPatient
      ? {
          ...(existing?.currentPatient ?? {}),
          ...patch.currentPatient,
        }
      : existing?.currentPatient;
    const merged: Partial<Omit<ClinicConversationState, 'workspaceId' | 'teamId' | 'conversationId' | 'updatedAt'>> = {
      ...(existing ?? {}),
      ...patch,
      ...(mergedCurrentPatient ? { currentPatient: mergedCurrentPatient } : {}),
    };
    delete (merged as { workspaceId?: string }).workspaceId;
    delete (merged as { teamId?: string }).teamId;
    delete (merged as { conversationId?: string }).conversationId;
    delete (merged as { updatedAt?: Date }).updatedAt;
    await ClinicConversationStateModel.updateOne(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        teamId: new Types.ObjectId(teamId),
        conversationId: key,
      },
      { $set: { state: merged } },
      { upsert: true },
    ).exec();
  }
}

