import mongoose, { Schema } from 'mongoose';

const ClinicConversationStateSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    conversationId: { type: String, required: true },
    state: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true },
);

ClinicConversationStateSchema.index(
  { workspaceId: 1, teamId: 1, conversationId: 1 },
  { unique: true },
);

export const ClinicConversationStateModel =
  mongoose.models.ClinicConversationState ||
  mongoose.model('ClinicConversationState', ClinicConversationStateSchema);

