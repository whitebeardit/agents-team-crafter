import mongoose, { Schema } from 'mongoose';

const ToolEntrySchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { _id: false },
);

const McpConnectionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'pending'],
      default: 'pending',
    },
    tools: { type: [ToolEntrySchema], default: [] },
    icon: { type: String, default: 'plug' },
    config: { type: Schema.Types.Mixed, default: {} },
    disconnectedAt: { type: Date },
  },
  { timestamps: true },
);

McpConnectionSchema.index({ workspaceId: 1, name: 1 });

export type McpConnectionDoc = mongoose.InferSchemaType<typeof McpConnectionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const McpConnectionModel =
  mongoose.models.McpConnection || mongoose.model('McpConnection', McpConnectionSchema);
