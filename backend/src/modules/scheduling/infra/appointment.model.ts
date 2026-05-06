import mongoose, { Schema } from 'mongoose';

const AppointmentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', index: true },
    serviceOrderId: { type: Schema.Types.ObjectId, ref: 'ServiceOrder', index: true },
    packageSaleId: { type: Schema.Types.ObjectId, ref: 'PackageSale', index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    reminderId: { type: Schema.Types.ObjectId, ref: 'Reminder', index: true },
    title: { type: String, required: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'cancelled', 'no_show', 'completed'],
      default: 'scheduled',
      index: true,
    },
    notes: { type: String, default: '' },
    origin: {
      type: {
        id: { type: String, required: true },
        type: { type: String, enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'], required: true },
        slug: { type: String, required: true },
      },
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_schedule_appointment' }),
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ workspaceId: 1, startsAt: 1, endsAt: 1 });

export const AppointmentModel =
  mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);
