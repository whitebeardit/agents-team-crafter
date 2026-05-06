import mongoose, { Schema } from 'mongoose';

const EvolutionNoteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: false, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: false, index: true },
    body: { type: String, required: true },
    origin: {
      type: {
        id: { type: String, required: true },
        type: { type: String, enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'], required: true },
        slug: { type: String, required: true },
      },
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_clinical_evolution_note' }),
    },
  },
  { timestamps: true },
);

export const EvolutionNoteModel =
  mongoose.models.EvolutionNote || mongoose.model('EvolutionNote', EvolutionNoteSchema);
