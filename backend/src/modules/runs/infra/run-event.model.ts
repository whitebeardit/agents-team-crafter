import mongoose, { Schema } from 'mongoose';

const RunEventSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    runId: { type: String, required: true, index: true },
    seq: { type: Number, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false },
);

RunEventSchema.index({ workspaceId: 1, runId: 1, seq: 1 });

export type RunEventDoc = mongoose.InferSchemaType<typeof RunEventSchema> & { _id: mongoose.Types.ObjectId };

export const RunEventModel = mongoose.models.RunEvent || mongoose.model('RunEvent', RunEventSchema);
