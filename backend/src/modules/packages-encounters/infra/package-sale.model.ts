import mongoose, { Schema } from 'mongoose';

const PackageSaleSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    packageName: { type: String, required: true },
    unitsTotal: { type: Number, required: true },
    unitsUsed: { type: Number, default: 0 },
    packageProductId: { type: Schema.Types.ObjectId, ref: 'PackageProduct', index: true },
    productSlug: { type: String, trim: true, lowercase: true },
    priceCentsAtSale: { type: Number, min: 0 },
  },
  { timestamps: true },
);

export const PackageSaleModel =
  mongoose.models.PackageSale || mongoose.model('PackageSale', PackageSaleSchema);
