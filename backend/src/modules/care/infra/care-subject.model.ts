import mongoose, { Schema } from 'mongoose';

const CareSubjectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    name: { type: String, required: true },
    subjectKind: { type: String, enum: ['human', 'animal', 'psych'], required: true, index: true },
    notes: { type: String },
    origin: {
      type: {
        id: { type: String, required: true },
        type: { type: String, enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'], required: true },
        slug: { type: String, required: true },
      },
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
