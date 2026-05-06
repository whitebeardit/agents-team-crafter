import mongoose, { Schema } from 'mongoose';

const ReceivableSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BRL' },
    dueDate: { type: Date, required: true, index: true },
    paid: { type: Boolean, default: false, index: true },
    description: { type: String, default: '' },
    origin: {
      type: {
        id: { type: String, required: true },
        type: { type: String, enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'], required: true },
        slug: { type: String, required: true },
      },
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_finance_receivable' }),
    },
    sourceEntity: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export const ReceivableModel =
  mongoose.models.Receivable || mongoose.model('Receivable', ReceivableSchema);
