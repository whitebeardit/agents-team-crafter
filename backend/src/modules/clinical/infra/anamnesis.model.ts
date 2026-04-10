import mongoose, { Schema } from 'mongoose';

const AnamnesisSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', required: true, index: true },
    template: { type: String, default: 'custom' },
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const AnamnesisModel =
  mongoose.models.Anamnesis || mongoose.model('Anamnesis', AnamnesisSchema);
