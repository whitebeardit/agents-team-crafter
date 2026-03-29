import mongoose, { Schema } from 'mongoose';

const SecretsEncryptedSchema = new Schema(
  {
    algorithm: { type: String, required: true },
    keyVersion: { type: Number, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const ChannelSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    type: {
      type: String,
      enum: [
        'whatsapp',
        'slack',
        'email',
        'api',
        'teams',
        'discord',
        'gchat',
        'telegram',
        'github',
        'linear',
      ],
      required: true,
    },
    /** native = integrações próprias do produto; chat_sdk = entrada via Chat SDK (Slack, etc.) */
    provider: { type: String, enum: ['native', 'chat_sdk'], default: 'native' },
    /** Plataforma real quando provider === chat_sdk (ex.: slack, discord). */
    platform: { type: String },
    name: { type: String, required: true },
    status: { type: String, enum: ['connected', 'disconnected', 'pending'], default: 'pending' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    config: { type: Schema.Types.Mixed, default: {} },
    /** Segredos Chat SDK cifrados (AES-256-GCM); plaintext só em memória no webhook. */
    secretsEncrypted: { type: SecretsEncryptedSchema, required: false },
    metrics: { type: Schema.Types.Mixed },
    connectedAt: { type: Date },
    disconnectedAt: { type: Date },
  },
  { timestamps: true },
);

ChannelSchema.index({ workspaceId: 1, type: 1 });
ChannelSchema.index({ workspaceId: 1, status: 1 });
ChannelSchema.index({ workspaceId: 1, type: 1, 'config.slackTeamId': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.discordGuildId': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.teamsTenantId': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.gchatSpaceName': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.githubInstallationId': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.linearTeamId': 1 });
ChannelSchema.index({ workspaceId: 1, provider: 1, platform: 1, 'config.whatsappPhoneNumberId': 1 });

export type ChannelDoc = mongoose.InferSchemaType<typeof ChannelSchema> & { _id: mongoose.Types.ObjectId };

export const ChannelModel = mongoose.models.Channel || mongoose.model('Channel', ChannelSchema);
