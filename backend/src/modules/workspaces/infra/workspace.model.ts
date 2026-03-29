import mongoose, { Schema } from 'mongoose';

const IntegrationSecretsBlobSchema = new Schema(
  {
    algorithm: { type: String, required: true },
    keyVersion: { type: Number, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true },
    logo: { type: String },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    settings: { type: Schema.Types.Mixed, default: {} },
    limits: { type: Schema.Types.Mixed, default: {} },
    /** Segredos de integração do tenant (LLM, SMTP, Slack) — AES-GCM via ENCRYPTION_MASTER_KEY */
    integrationSecretsEncrypted: { type: IntegrationSecretsBlobSchema, required: false },
  },
  { timestamps: true },
);

export type WorkspaceDoc = mongoose.InferSchemaType<typeof WorkspaceSchema> & { _id: mongoose.Types.ObjectId };

export const WorkspaceModel = mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema);
