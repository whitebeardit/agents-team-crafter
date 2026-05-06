import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const PayableSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    destinationPartyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BRL' },
    dueDate: { type: Date, required: true, index: true },
    paid: { type: Boolean, default: false, index: true },
    description: { type: String, default: '' },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_finance_payable' }),
    },
    sourceEntity: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export const PayableModel =
  mongoose.models.Payable || mongoose.model('Payable', PayableSchema);
