import mongoose, { Schema } from 'mongoose';

const ReminderSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true },
    at: { type: Date, required: true, index: true },
    done: { type: Boolean, default: false, index: true },
    cancelled: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const ReminderModel =
  mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
