import mongoose, { Schema } from 'mongoose';

const RunStepSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    runId: { type: String, required: true, index: true },
    stepIndex: { type: Number, required: true },
    stepType: { type: String, required: true },
    agentId: { type: String },
    toolName: { type: String },
    status: { type: String, required: true },
    summary: { type: String, default: '' },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true },
);

RunStepSchema.index({ workspaceId: 1, runId: 1, stepIndex: 1 });

export type RunStepDoc = mongoose.InferSchemaType<typeof RunStepSchema> & { _id: mongoose.Types.ObjectId };

export const RunStepModel = mongoose.models.RunStep || mongoose.model('RunStep', RunStepSchema);
