import mongoose, { Schema } from 'mongoose';

const TeamSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    objective: { type: String },
    status: { type: String, enum: ['active', 'draft', 'inactive'], default: 'draft' },
    coordinatorId: { type: Schema.Types.ObjectId, required: true },
    agentIds: [{ type: Schema.Types.ObjectId }],
    channelIds: [{ type: Schema.Types.ObjectId }],
    primaryChannel: { type: String },
    singleAgentMode: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TeamSchema.index({ workspaceId: 1, status: 1 });
TeamSchema.index({ workspaceId: 1, coordinatorId: 1 });

export type TeamDoc = mongoose.InferSchemaType<typeof TeamSchema> & { _id: mongoose.Types.ObjectId };

export const TeamModel = mongoose.models.Team || mongoose.model('Team', TeamSchema);
