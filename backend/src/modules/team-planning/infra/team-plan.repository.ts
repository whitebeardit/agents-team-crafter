import { Types } from 'mongoose';
import { TeamPlanModel } from './team-plan.model.js';
import type { TeamPlanDoc } from './team-plan.model.js';

function toPublic(doc: TeamPlanDoc) {
  return {
    id: doc._id.toString(),
    problem: doc.problem,
    context: doc.context,
    status: doc.status,
    team: doc.team,
    agents: doc.agents ?? [],
    graph: doc.graph ?? { nodes: [], edges: [] },
    executionChecklist: doc.executionChecklist ?? [],
    requiredPacks: doc.requiredPacks ?? [],
    requiredTools: doc.requiredTools ?? [],
    bindOverrides: doc.bindOverrides ?? { agents: {} },
    plannerMeta: doc.plannerMeta ?? {},
    reuseSummary: doc.reuseSummary ?? {},
    result: doc.result ?? null,
    lastOperationId: doc.lastOperationId,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export class TeamPlanRepository {
  async create(
    workspaceId: string,
    input: {
      problem: string;
      context?: string;
      status: 'draft' | 'ready';
      team: Record<string, unknown>;
      agents: unknown[];
      graph: Record<string, unknown>;
      executionChecklist: string[];
      requiredPacks?: string[];
      requiredTools?: string[];
      bindOverrides?: Record<string, unknown>;
      plannerMeta?: Record<string, unknown>;
      reuseSummary?: Record<string, unknown>;
    },
  ) {
    const doc = await TeamPlanModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      ...input,
    });
    return toPublic(doc as TeamPlanDoc);
  }

  async findById(workspaceId: string, id: string) {
    const doc = await TeamPlanModel.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) });
    return doc ? toPublic(doc as TeamPlanDoc) : null;
  }

  async update(workspaceId: string, id: string, patch: Record<string, unknown>) {
    const doc = await TeamPlanModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: patch },
      { new: true },
    );
    return doc ? toPublic(doc as TeamPlanDoc) : null;
  }
}
