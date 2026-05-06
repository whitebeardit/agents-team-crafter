import mongoose, { Schema } from 'mongoose';

const PartySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    displayName: { type: String, required: true, index: true },
    roles: [{ type: String }],
    /** Loop 87 — semântica para “clientes ativos” vs inativos */
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    email: { type: String },
    phone: { type: String },
    notes: { type: String },
    origin: {
      type: {
        id: { type: String, required: true },
        type: { type: String, enum: ['agent-coordinator', 'agent-specialist', 'user-manual', 'system'], required: true },
        slug: { type: String, required: true },
      },
      required: true,
      default: () => ({ id: 'system', type: 'system', slug: 'legacy_crm_party' }),
    },
  },
  { timestamps: true },
);

PartySchema.index({ workspaceId: 1, displayName: 1 });
PartySchema.index({ workspaceId: 1, status: 1 });
/** Celular normalizado (apenas digitos) unico por workspace; ignora documentos sem phone. */
PartySchema.index(
  { workspaceId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string', $gt: '' } } },
);

export type PartyDoc = mongoose.InferSchemaType<typeof PartySchema> & { _id: mongoose.Types.ObjectId };

export const PartyModel = mongoose.models.Party || mongoose.model('Party', PartySchema);
