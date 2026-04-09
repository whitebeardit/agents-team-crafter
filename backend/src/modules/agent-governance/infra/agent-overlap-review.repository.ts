import { Types } from 'mongoose';
import { AgentOverlapReviewModel } from './agent-overlap-review.model.js';
import type { AgentOverlapReviewDoc } from './agent-overlap-review.model.js';
import type { IAgentOverlapReview, TOverlapDecision } from '../domain/agent-governance.types.js';

function toPublic(doc: AgentOverlapReviewDoc): IAgentOverlapReview {
  const draftAgent = {
    ...doc.draftAgent,
    id: doc.draftAgent.id ?? undefined,
    description: doc.draftAgent.description ?? undefined,
    goal: doc.draftAgent.goal ?? undefined,
    systemRole: doc.draftAgent.systemRole ?? null,
  };
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    draftAgent,
    matches: doc.matches ?? [],
    decision: doc.decision,
    summary: doc.summary,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export class AgentOverlapReviewRepository {
  async create(workspaceId: string, input: Omit<IAgentOverlapReview, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) {
    const doc = await AgentOverlapReviewModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      ...input,
    });
    return toPublic(doc as AgentOverlapReviewDoc);
  }

  async listRecent(workspaceId: string, limit = 20) {
    const docs = await AgentOverlapReviewModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((doc) => toPublic(doc as AgentOverlapReviewDoc));
  }

  async countByDecisionSince(workspaceId: string, decision: TOverlapDecision, since: Date) {
    return AgentOverlapReviewModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      decision,
      createdAt: { $gte: since },
    });
  }
}
