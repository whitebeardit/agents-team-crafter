import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String },
    preferences: { type: Schema.Types.Mixed, default: {} },
    workspaceIds: [{ type: Schema.Types.ObjectId, ref: 'Workspace' }],
    refreshTokenHash: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
