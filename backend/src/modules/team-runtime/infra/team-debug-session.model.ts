import mongoose, { Schema } from 'mongoose';

const TurnSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const TeamDebugSessionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    /** ID estável enviado pelo cliente (ex.: UUID) */
    conversationId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    turns: { type: [TurnSchema], default: [] },
  },
  { timestamps: true },
);

TeamDebugSessionSchema.index({ workspaceId: 1, teamId: 1, conversationId: 1 }, { unique: true });

export type TeamDebugSessionDoc = mongoose.InferSchemaType<typeof TeamDebugSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TeamDebugSessionModel =
  mongoose.models.TeamDebugSession || mongoose.model('TeamDebugSession', TeamDebugSessionSchema);
