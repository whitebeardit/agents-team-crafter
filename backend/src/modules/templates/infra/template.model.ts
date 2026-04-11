import mongoose, { Schema } from 'mongoose';

const TemplateSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    origin: { type: String, enum: ['whitebeard', 'company'], required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    version: { type: String, default: '1.0.0' },
    category: { type: String, default: 'Geral' },
    agentCount: { type: Number, default: 0 },
    teamConfig: { type: Schema.Types.Mixed, default: {} },
    graph: {
      nodes: { type: Schema.Types.Mixed, default: [] },
      edges: { type: Schema.Types.Mixed, default: [] },
    },
    agentsSnapshot: { type: Schema.Types.Mixed, default: [] },
    /** Vertical de negocio (ex.: saude, atendimento) para curadoria e filtro na UI */
    vertical: { type: String, default: '' },
    /** Bullets mostrados antes de aplicar o template */
    prerequisites: [{ type: String }],
    /** Texto honesto sobre o que `apply` faz de facto (nao marketing) */
    applyBehavior: { type: String, default: '' },
  },
  { timestamps: true },
);

TemplateSchema.index({ workspaceId: 1, origin: 1 });
TemplateSchema.index({ workspaceId: 1, category: 1 });

export type TemplateDoc = mongoose.InferSchemaType<typeof TemplateSchema> & { _id: mongoose.Types.ObjectId };

export const TemplateModel = mongoose.models.Template || mongoose.model('Template', TemplateSchema);
