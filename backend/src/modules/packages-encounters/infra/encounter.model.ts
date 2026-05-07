import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const EncounterSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    packageSaleId: { type: Schema.Types.ObjectId, ref: 'PackageSale', index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', index: true },
    encounterKind: { type: String, enum: ['visit', 'clinical'], default: 'visit' },
    clinicalStatus: { type: String, enum: ['open', 'closed'], default: 'closed' },
    notes: { type: String, default: '' },
    durationMinutes: { type: Number, default: 0 },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_encounter' }),
    },
  },
  { timestamps: true },
);

export const EncounterModel =
  mongoose.models.Encounter || mongoose.model('Encounter', EncounterSchema);
