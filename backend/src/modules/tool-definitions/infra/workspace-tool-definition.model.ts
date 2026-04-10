import mongoose, { Schema } from 'mongoose';

const WorkspaceToolDefinitionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    kind: {
      type: String,
      enum: ['builtin_ref', 'http_webhook', 'mcp_ref', 'internal_action'],
      required: true,
    },
    jsonSchema: { type: Schema.Types.Mixed, default: {} },
    config: { type: Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

WorkspaceToolDefinitionSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

export type WorkspaceToolDefinitionDoc = mongoose.InferSchemaType<typeof WorkspaceToolDefinitionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WorkspaceToolDefinitionModel =
  mongoose.models.WorkspaceToolDefinition ||
  mongoose.model('WorkspaceToolDefinition', WorkspaceToolDefinitionSchema);
