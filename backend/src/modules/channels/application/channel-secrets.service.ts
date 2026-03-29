import type { IEnv } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { decryptJson, encryptJson, type IEncryptedPayload } from '../../../utils/secrets-crypto.js';
import type { ChannelDoc } from '../infra/channel.model.js';
import type { IChatSdkSecretsPayload } from '../domain/chat-sdk-secrets.schema.js';
import { maskSecretPayloadForApi } from '../domain/chat-sdk-secrets.schema.js';

export class ChannelSecretsService {
  constructor(private readonly env: IEnv) {}

  private requireMasterKey(): string {
    const k = this.env.ENCRYPTION_MASTER_KEY;
    if (!k?.trim()) {
      throw new AppError(
        'CONFIG_ERROR',
        'ENCRYPTION_MASTER_KEY nao configurada; necessaria para armazenar segredos',
        503,
      );
    }
    return k.trim();
  }

  encryptPayload(payload: IChatSdkSecretsPayload): IEncryptedPayload {
    return encryptJson(this.requireMasterKey(), payload);
  }

  decryptPayload(doc: ChannelDoc): IChatSdkSecretsPayload | null {
    const enc = (doc as { secretsEncrypted?: IEncryptedPayload }).secretsEncrypted;
    if (!enc?.ciphertext) return null;
    const k = this.env.ENCRYPTION_MASTER_KEY?.trim();
    if (!k) return null;
    try {
      return decryptJson<IChatSdkSecretsPayload>(k, enc);
    } catch {
      return null;
    }
  }

  /** Para respostas GET: máscara se houver segredos; nunca plaintext. */
  secretsPreview(doc: ChannelDoc): Record<string, string> | undefined {
    const plain = this.decryptPayload(doc);
    if (!plain) return undefined;
    return maskSecretPayloadForApi(plain);
  }
}
