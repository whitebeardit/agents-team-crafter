import mongoose, { Schema } from 'mongoose';

const VaultNoteIndexSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    agentId: { type: String, required: true, index: true },
    noteId: { type: String, required: true },
    notePath: { type: String, required: true },
    status: { type: String, required: true, index: true },
    kind: { type: String, required: true, index: true },
    tags: [{ type: String }],
    confidence: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    supersedesNoteId: { type: String },
    contentHash: { type: String, required: true },
    title: { type: String, default: '' },
    bodyPreview: { type: String, default: '' },
    lastGitCommit: { type: String },
  },
  { timestamps: true },
);

VaultNoteIndexSchema.index({ workspaceId: 1, noteId: 1 }, { unique: true });
VaultNoteIndexSchema.index({ workspaceId: 1, agentId: 1, status: 1 });
VaultNoteIndexSchema.index({ workspaceId: 1, tags: 1 });

export type VaultNoteIndexDoc = mongoose.InferSchemaType<typeof VaultNoteIndexSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const VaultNoteIndexModel =
  mongoose.models.VaultNoteIndex || mongoose.model('VaultNoteIndex', VaultNoteIndexSchema);
