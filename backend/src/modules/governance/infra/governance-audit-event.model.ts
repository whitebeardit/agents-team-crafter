import mongoose, { Schema } from 'mongoose';

const GovernanceAuditEventSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    correlationId: { type: String },
    eventType: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

GovernanceAuditEventSchema.index({ workspaceId: 1, createdAt: -1 });

export type GovernanceAuditEventDoc = mongoose.InferSchemaType<typeof GovernanceAuditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GovernanceAuditEventModel =
  mongoose.models.GovernanceAuditEvent || mongoose.model('GovernanceAuditEvent', GovernanceAuditEventSchema);
