import mongoose, { Schema } from 'mongoose';

const AuditLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number },
    durationMs: { type: Number },
    correlationId: { type: String },
  },
  { timestamps: true },
);

AuditLogSchema.index({ workspaceId: 1, createdAt: -1 });

export type AuditLogDoc = mongoose.InferSchemaType<typeof AuditLogSchema> & { _id: mongoose.Types.ObjectId };

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
