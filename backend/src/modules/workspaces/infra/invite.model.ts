import mongoose, { Schema } from 'mongoose';

const InviteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export type InviteDoc = mongoose.InferSchemaType<typeof InviteSchema> & { _id: mongoose.Types.ObjectId };

export const InviteModel = mongoose.models.Invite || mongoose.model('Invite', InviteSchema);
