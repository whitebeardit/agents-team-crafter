import mongoose, { Schema } from 'mongoose';

/**
 * Próximo seq por (workspace, team, run) sem corrida de leitura: `issued` guarda o último
 * seq já emitido pelo contador; o primeiro upsert alinha com max(seq) na timeline.
 */
const ConversationTimelineSeqSchema = new Schema(
  {
    _id: { type: String, required: true },
    issued: { type: Number, required: true },
  },
  { collection: 'conversationtimelineseqs' },
);

export const ConversationTimelineSeqModel =
  mongoose.models.ConversationTimelineSeq ||
  mongoose.model('ConversationTimelineSeq', ConversationTimelineSeqSchema);
