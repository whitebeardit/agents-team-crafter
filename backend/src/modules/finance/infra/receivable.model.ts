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
    sourceEntity: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export const ReceivableModel =
  mongoose.models.Receivable || mongoose.model('Receivable', ReceivableSchema);
