import mongoose, { Schema } from 'mongoose';

const ConversationTimelineSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    runId: { type: String, required: true, index: true },
    seq: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
    actor: { type: String, required: true },
    actorId: { type: String },
    kind: { type: String, required: true },
    content: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    correlation: {
      spanId: { type: String },
      parentSpanId: { type: String },
    },
  },
  { timestamps: false },
);

ConversationTimelineSchema.index({ workspaceId: 1, teamId: 1, runId: 1, seq: 1 }, { unique: true });
ConversationTimelineSchema.index({ workspaceId: 1, teamId: 1, seq: -1 });

export type ConversationTimelineDoc = mongoose.InferSchemaType<typeof ConversationTimelineSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ConversationTimelineModel =
  mongoose.models.ConversationTimeline || mongoose.model('ConversationTimeline', ConversationTimelineSchema);
