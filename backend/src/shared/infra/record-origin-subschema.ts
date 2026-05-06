import { Schema } from 'mongoose';

/**
 * Subdocumento Mongoose para `TRecordOrigin` (`{ id, type, slug }`).
 * Deve ser um `Schema` explícito: um campo chamado `type` dentro de um objeto
 * literal aninhado em `origin` confunde o parser do Mongoose (path `required`).
 */
export const RecordOriginSubschema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'],
      required: true,
    },
    slug: { type: String, required: true },
  },
  { _id: false },
);
