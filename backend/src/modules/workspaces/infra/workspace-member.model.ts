import mongoose, { Schema } from 'mongoose';

const WorkspaceMemberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export type WorkspaceMemberDoc = mongoose.InferSchemaType<typeof WorkspaceMemberSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WorkspaceMemberModel =
  mongoose.models.WorkspaceMember || mongoose.model('WorkspaceMember', WorkspaceMemberSchema);
