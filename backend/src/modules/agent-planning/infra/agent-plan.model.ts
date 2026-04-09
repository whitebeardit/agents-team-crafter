import mongoose, { Schema } from 'mongoose';

const AgentPlanSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'ready', 'executing', 'executed', 'blocked', 'failed'],
      default: 'draft',
      index: true,
    },
    request: { type: Schema.Types.Mixed, required: true },
    draftAgent: { type: Schema.Types.Mixed, required: true },
    overlapReview: { type: Schema.Types.Mixed, default: null },
    decision: { type: String, enum: ['create_new', 'reuse_existing', 'split_scope', 'blocked'], required: true },
    notes: [{ type: String }],
    result: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

AgentPlanSchema.index({ workspaceId: 1, updatedAt: -1 });

export type AgentPlanDoc = mongoose.InferSchemaType<typeof AgentPlanSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AgentPlanModel = mongoose.models.AgentPlan || mongoose.model('AgentPlan', AgentPlanSchema);
