import mongoose, { Schema } from 'mongoose';

const PackageConsumptionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    packageSaleId: { type: Schema.Types.ObjectId, ref: 'PackageSale', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: false, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    consumedAt: { type: Date, required: true },
    units: { type: Number, required: true, default: 1 },
  },
  { timestamps: true },
);

PackageConsumptionSchema.index({ workspaceId: 1, packageSaleId: 1, encounterId: 1 }, { unique: true });

export const PackageConsumptionModel =
  mongoose.models.PackageConsumption || mongoose.model('PackageConsumption', PackageConsumptionSchema);

