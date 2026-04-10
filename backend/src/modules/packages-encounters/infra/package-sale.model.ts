import mongoose, { Schema } from 'mongoose';

const PackageSaleSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    packageName: { type: String, required: true },
    unitsTotal: { type: Number, required: true },
    unitsUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PackageSaleModel =
  mongoose.models.PackageSale || mongoose.model('PackageSale', PackageSaleSchema);
