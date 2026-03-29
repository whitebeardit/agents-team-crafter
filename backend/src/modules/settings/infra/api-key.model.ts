import mongoose, { Schema } from 'mongoose';

const ApiKeySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    prefix: { type: String, required: true },
    hashedKey: { type: String, required: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

ApiKeySchema.index({ workspaceId: 1, name: 1 });

export type ApiKeyDoc = mongoose.InferSchemaType<typeof ApiKeySchema> & { _id: mongoose.Types.ObjectId };

export const ApiKeyModel = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
