import mongoose, { Schema } from 'mongoose';
import { RecordOriginSubschema } from '../../../shared/infra/record-origin-subschema.js';

const ReceivableSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BRL' },
    dueDate: { type: Date, required: true, index: true },
    paid: { type: Boolean, default: false, index: true },
    paidAt: { type: Date, index: true },
    paymentNote: { type: String, default: '' },
    description: { type: String, default: '' },
    origin: {
      type: RecordOriginSubschema,
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_finance_receivable' }),
    },
    sourceEntity: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

ReceivableSchema.index({ workspaceId: 1, partyId: 1, paid: 1 });
ReceivableSchema.index({ workspaceId: 1, sourceEntity: 1, sourceId: 1 });

export const ReceivableModel =
  mongoose.models.Receivable || mongoose.model('Receivable', ReceivableSchema);
