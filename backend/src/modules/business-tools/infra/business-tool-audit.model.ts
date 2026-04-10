import mongoose, { Schema } from 'mongoose';

const BusinessToolAuditSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    toolDefinitionId: { type: String, required: true },
    actionId: { type: String, required: true, index: true },
    ok: { type: Boolean, required: true },
    errorCode: { type: String },
    inputPreview: { type: String },
    resultPreview: { type: String },
    correlationId: { type: String, index: true },
  },
  { timestamps: true },
);

BusinessToolAuditSchema.index({ workspaceId: 1, createdAt: -1 });

export type BusinessToolAuditDoc = mongoose.InferSchemaType<typeof BusinessToolAuditSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BusinessToolAuditModel =
  mongoose.models.BusinessToolAudit ||
  mongoose.model('BusinessToolAudit', BusinessToolAuditSchema);
