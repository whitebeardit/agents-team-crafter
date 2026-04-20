import mongoose, { Schema } from 'mongoose';

const RunSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    runId: { type: String, required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    coordinatorAgentId: { type: String, required: true },
    trigger: { type: String, default: 'manual' },
    source: { type: String, enum: ['manual', 'inbound', 'planner'], default: 'manual', index: true },
    channel: { type: String, default: 'debug' },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'interrupted', 'cancelled'],
      default: 'running',
      index: true,
    },
    correlationId: { type: String },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    externalResponse: { type: Schema.Types.Mixed, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    interrupt: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

RunSchema.index({ workspaceId: 1, teamId: 1, startedAt: -1 });
RunSchema.index({ workspaceId: 1, runId: 1 }, { unique: true });

export type RunDoc = mongoose.InferSchemaType<typeof RunSchema> & { _id: mongoose.Types.ObjectId };

export const RunModel = mongoose.models.Run || mongoose.model('Run', RunSchema);
