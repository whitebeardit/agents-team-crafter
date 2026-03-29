import mongoose, { Schema } from 'mongoose';

const KnowledgeSourceSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['document', 'database', 'api', 'website'], required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'syncing'], default: 'inactive' },
    lastSyncAt: { type: Date },
    itemCount: { type: Number, default: 0 },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

KnowledgeSourceSchema.index({ workspaceId: 1, type: 1 });

export type KnowledgeSourceDoc = mongoose.InferSchemaType<typeof KnowledgeSourceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const KnowledgeSourceModel =
  mongoose.models.KnowledgeSource || mongoose.model('KnowledgeSource', KnowledgeSourceSchema);
