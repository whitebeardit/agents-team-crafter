import mongoose, { Schema } from 'mongoose';

const AvailabilitySlotSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    slotMinutes: { type: Number, required: true, default: 30 },
    label: { type: String, default: '' },
  },
  { timestamps: true },
);

AvailabilitySlotSchema.index({ workspaceId: 1, startsAt: 1, endsAt: 1 });

export const AvailabilitySlotModel =
  mongoose.models.AvailabilitySlot || mongoose.model('AvailabilitySlot', AvailabilitySlotSchema);
