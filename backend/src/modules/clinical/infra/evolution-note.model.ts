import mongoose, { Schema } from 'mongoose';

const EvolutionNoteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    careSubjectId: { type: Schema.Types.ObjectId, ref: 'CareSubject', required: true, index: true },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

export const EvolutionNoteModel =
  mongoose.models.EvolutionNote || mongoose.model('EvolutionNote', EvolutionNoteSchema);
