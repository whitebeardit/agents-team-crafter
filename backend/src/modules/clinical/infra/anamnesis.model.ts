import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const AnamnesisSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', required: true, index: true },
    template: { type: String, default: 'custom' },
    content: { type: Schema.Types.Mixed, required: true },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_clinical_anamnesis' }),
    },
  },
  { timestamps: true },
);

export const AnamnesisModel =
  mongoose.models.Anamnesis || mongoose.model('Anamnesis', AnamnesisSchema);
