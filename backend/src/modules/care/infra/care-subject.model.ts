import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const CareSubjectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    name: { type: String, required: true },
    subjectKind: { type: String, enum: ['human', 'animal', 'psych'], required: true, index: true },
    notes: { type: String },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_care_subject' }),
    },
  },
  { timestamps: true },
);

CareSubjectSchema.index({ workspaceId: 1, name: 1 });

export type CareSubjectDoc = mongoose.InferSchemaType<typeof CareSubjectSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CareSubjectModel =
  mongoose.models.CareSubject || mongoose.model('CareSubject', CareSubjectSchema);
