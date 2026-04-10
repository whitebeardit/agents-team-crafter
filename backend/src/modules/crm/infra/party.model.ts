import mongoose, { Schema } from 'mongoose';

const PartySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    displayName: { type: String, required: true, index: true },
    roles: [{ type: String }],
    email: { type: String },
    phone: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

PartySchema.index({ workspaceId: 1, displayName: 1 });

export type PartyDoc = mongoose.InferSchemaType<typeof PartySchema> & { _id: mongoose.Types.ObjectId };

export const PartyModel = mongoose.models.Party || mongoose.model('Party', PartySchema);
