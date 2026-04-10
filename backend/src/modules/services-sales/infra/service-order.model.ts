import mongoose, { Schema } from 'mongoose';

const LineSchema = new Schema(
  {
    catalogItemId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
  },
  { _id: false },
);

const ServiceOrderSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    lines: { type: [LineSchema], default: [] },
    status: { type: String, enum: ['open', 'paid', 'cancelled'], default: 'open', index: true },
    totalPaid: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ServiceOrderModel =
  mongoose.models.ServiceOrder || mongoose.model('ServiceOrder', ServiceOrderSchema);
