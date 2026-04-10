import mongoose, { Schema } from 'mongoose';

const PayableSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    destinationPartyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BRL' },
    dueDate: { type: Date, required: true, index: true },
    paid: { type: Boolean, default: false, index: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

export const PayableModel =
  mongoose.models.Payable || mongoose.model('Payable', PayableSchema);
