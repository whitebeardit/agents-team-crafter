import mongoose, { Schema } from 'mongoose';

const AgentMcpBindingSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    mcpConnectionId: { type: Schema.Types.ObjectId, ref: 'McpConnection', required: true },
    allowedTools: [{ type: String }],
    requiresApproval: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AgentMcpBindingSchema.index({ workspaceId: 1, agentId: 1, mcpConnectionId: 1 }, { unique: true });

export type AgentMcpBindingDoc = mongoose.InferSchemaType<typeof AgentMcpBindingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AgentMcpBindingModel =
  mongoose.models.AgentMcpBinding || mongoose.model('AgentMcpBinding', AgentMcpBindingSchema);
