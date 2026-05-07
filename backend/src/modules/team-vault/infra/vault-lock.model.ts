import mongoose, { Schema } from 'mongoose';

const VaultLockSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true },
    holder: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export type VaultLockDoc = mongoose.InferSchemaType<typeof VaultLockSchema> & { _id: mongoose.Types.ObjectId };

export const VaultLockModel = mongoose.models.VaultLock || mongoose.model('VaultLock', VaultLockSchema);
