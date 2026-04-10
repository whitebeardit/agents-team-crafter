import mongoose, { Schema } from 'mongoose';

const ServiceCatalogItemSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    currency: { type: String, default: 'BRL' },
  },
  { timestamps: true },
);

export const ServiceCatalogItemModel =
  mongoose.models.ServiceCatalogItem || mongoose.model('ServiceCatalogItem', ServiceCatalogItemSchema);
