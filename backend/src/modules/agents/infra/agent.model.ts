import mongoose, { Schema } from 'mongoose';

const AgentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    role: { type: String, enum: ['coordinator', 'specialist'], required: true },
    origin: { type: String, enum: ['whitebeard', 'company'], required: true },
    skills: [{ type: String }],
    version: { type: String, default: '1.0.0' },
    avatar: { type: String },
    category: { type: String, default: 'Geral' },
    channels: [{ type: String }],
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
    goal: { type: String },
    responsibilities: [{ type: String }],
    systemInstruction: { type: String },
    capabilities: { type: Schema.Types.Mixed },
    knowledge: { type: Schema.Types.Mixed },
    channelConfig: { type: Schema.Types.Mixed },
    security: { type: Schema.Types.Mixed },
    documentation: { type: String },
    changelog: { type: Schema.Types.Mixed },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

AgentSchema.index({ workspaceId: 1, status: 1 });
AgentSchema.index({ workspaceId: 1, origin: 1 });
AgentSchema.index({ workspaceId: 1, role: 1 });
AgentSchema.index({ workspaceId: 1, category: 1 });

export type AgentDoc = mongoose.InferSchemaType<typeof AgentSchema> & { _id: mongoose.Types.ObjectId };

export const AgentModel = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
