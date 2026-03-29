import mongoose, { Schema } from 'mongoose';

const TeamGraphSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    nodes: { type: Schema.Types.Mixed, default: [] },
    edges: { type: Schema.Types.Mixed, default: [] },
    validationState: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type TeamGraphDoc = mongoose.InferSchemaType<typeof TeamGraphSchema> & { _id: mongoose.Types.ObjectId };

export const TeamGraphModel = mongoose.models.TeamGraph || mongoose.model('TeamGraph', TeamGraphSchema);
