import mongoose, { Schema } from 'mongoose';

const TeamPlanAgentSchema = new Schema(
  {
    name: { type: String, required: true },
    role: { type: String, enum: ['coordinator', 'specialist'], required: true },
    description: { type: String, default: '' },
    objective: { type: String, default: '' },
    responsibilities: [{ type: String }],
    skills: [{ type: String }],
    category: { type: String, default: 'geral' },
    channels: [{ type: String }],
    planningMode: {
      type: String,
      enum: ['existing', 'new', 'split_required', 'conflict'],
      default: 'new',
    },
    existingAgentId: { type: String, default: null },
    overlapScore: { type: Number, default: 0 },
    overlapReason: { type: String, default: '' },
  },
  { _id: false },
);

const TeamPlanSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    problem: { type: String, required: true },
    context: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'ready', 'executing', 'executed', 'failed'],
      default: 'draft',
      index: true,
    },
    team: { type: Schema.Types.Mixed, required: true },
    agents: { type: [TeamPlanAgentSchema], default: [] },
    graph: { type: Schema.Types.Mixed, default: { nodes: [], edges: [] } },
    executionChecklist: [{ type: String }],
    plannerMeta: { type: Schema.Types.Mixed, default: {} },
    reuseSummary: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: null },
    lastOperationId: { type: String },
  },
  { timestamps: true },
);

TeamPlanSchema.index({ workspaceId: 1, updatedAt: -1 });

export type TeamPlanDoc = mongoose.InferSchemaType<typeof TeamPlanSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TeamPlanModel = mongoose.models.TeamPlan || mongoose.model('TeamPlan', TeamPlanSchema);
