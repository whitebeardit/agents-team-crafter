import mongoose, { Schema } from 'mongoose';

const PackageProductSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    units: { type: Number, required: true, min: 1 },
    priceCents: { type: Number, min: 0 },
  },
  { timestamps: true },
);

PackageProductSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

export const PackageProductModel =
  mongoose.models.PackageProduct || mongoose.model('PackageProduct', PackageProductSchema);
