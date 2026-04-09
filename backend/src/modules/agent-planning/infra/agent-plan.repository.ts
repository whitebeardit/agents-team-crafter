import { Types } from 'mongoose';
import { AgentPlanModel } from './agent-plan.model.js';
import type { AgentPlanDoc } from './agent-plan.model.js';

function toPublic(doc: AgentPlanDoc) {
  return {
    id: doc._id.toString(),
    status: doc.status,
    request: doc.request,
    draftAgent: doc.draftAgent,
    overlapReview: doc.overlapReview ?? null,
    decision: doc.decision,
    notes: doc.notes ?? [],
    result: doc.result ?? null,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export class AgentPlanRepository {
  async create(workspaceId: string, input: Record<string, unknown>) {
    const doc = await AgentPlanModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      ...input,
    });
    return toPublic(doc as AgentPlanDoc);
  }

  async findById(workspaceId: string, id: string) {
    const doc = await AgentPlanModel.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) });
    return doc ? toPublic(doc as AgentPlanDoc) : null;
  }

  async update(workspaceId: string, id: string, patch: Record<string, unknown>) {
    const doc = await AgentPlanModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: patch },
      { new: true },
    );
    return doc ? toPublic(doc as AgentPlanDoc) : null;
  }
}
