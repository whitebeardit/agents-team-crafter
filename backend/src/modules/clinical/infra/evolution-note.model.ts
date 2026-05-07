import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const EvolutionNoteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: false, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: false, index: true },
    body: { type: String, required: true },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_clinical_evolution_note' }),
    },
  },
  { timestamps: true },
);

export const EvolutionNoteModel =
  mongoose.models.EvolutionNote || mongoose.model('EvolutionNote', EvolutionNoteSchema);
