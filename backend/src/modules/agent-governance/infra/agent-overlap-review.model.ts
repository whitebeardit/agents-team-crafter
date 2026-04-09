import mongoose, { Schema } from 'mongoose';

const AgentDomainProfileSchema = new Schema(
  {
    summary: { type: String, default: '' },
    keywords: [{ type: String }],
    inputDescription: { type: String, default: '' },
    outputDescription: { type: String, default: '' },
    boundaries: [{ type: String }],
    exclusions: [{ type: String }],
  },
  { _id: false },
);

const AgentGovernanceDraftSchema = new Schema(
  {
    id: { type: String },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    role: { type: String, enum: ['coordinator', 'specialist'], required: true },
    category: { type: String, default: 'geral' },
    skills: [{ type: String }],
    goal: { type: String, default: '' },
    responsibilities: [{ type: String }],
    domain: { type: AgentDomainProfileSchema, default: {} },
    qualityCriteria: [{ type: String }],
    reuseHints: [{ type: String }],
    platformManaged: { type: Boolean, default: false },
    systemRole: { type: String, enum: ['team-crafter', 'agent-crafter', 'domain-guard', null], default: null },
  },
  { _id: false },
);

const AgentOverlapMatchSchema = new Schema(
  {
    agentId: { type: String, required: true },
    agentName: { type: String, required: true },
    agentRole: { type: String, enum: ['coordinator', 'specialist'], required: true },
    score: { type: Number, required: true },
    classification: { type: String, enum: ['safe', 'warning', 'conflict'], required: true },
    reason: { type: String, required: true },
    recommendation: { type: String, enum: ['safe_to_create', 'refine_scope', 'reuse_existing'], required: true },
  },
  { _id: false },
);

const AgentOverlapReviewSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    draftAgent: { type: AgentGovernanceDraftSchema, required: true },
    matches: { type: [AgentOverlapMatchSchema], default: [] },
    decision: { type: String, enum: ['allow', 'review', 'block', 'reuse_existing'], required: true, index: true },
    summary: { type: String, required: true },
  },
  { timestamps: true },
);

AgentOverlapReviewSchema.index({ workspaceId: 1, createdAt: -1 });

export type AgentOverlapReviewDoc = mongoose.InferSchemaType<typeof AgentOverlapReviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AgentOverlapReviewModel =
  mongoose.models.AgentOverlapReview || mongoose.model('AgentOverlapReview', AgentOverlapReviewSchema);
