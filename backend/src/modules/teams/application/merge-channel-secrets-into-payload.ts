import { AppError } from '../../../shared/errors/app-error.js';
import { parseChatSdkSecretsBody } from '../../channels/domain/chat-sdk-secrets.schema.js';
import { isChatSdkPlatform } from '../../channels/domain/chat-sdk-platform.js';
import type { ChannelSecretsService } from '../../channels/application/channel-secrets.service.js';
import type { TTeamExportChannelFullSnapshot } from './build-team-export.js';

/**
 * Injeita `secretsEncrypted` (cifrado) nos snapshots de canais a partir de `channelSecretPayloads` (claro, por legacyId).
 * Só aplica a canais com `provider === 'chat_sdk'` e plataforma reconhecida.
 */
export function mergeChannelSecretsIntoImportPayload(
  raw: unknown,
  channelSecretPayloads: Record<string, unknown>,
  channelSecretsService: ChannelSecretsService,
): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const p = { ...(raw as Record<string, unknown>) };
  const chFull = p['channelsFull'];
  if (!Array.isArray(chFull)) return raw;

  const newFull: TTeamExportChannelFullSnapshot[] = chFull.map((row) => {
    const c = { ...(row as TTeamExportChannelFullSnapshot) };
    const key = c.legacyId;
    if (!key || !channelSecretPayloads[key]) return c;

    const prov = c.provider;
    if (prov !== 'chat_sdk') {
      return c;
    }
    const plat = typeof c.platform === 'string' ? c.platform : '';
    if (!plat || !isChatSdkPlatform(plat)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Canal ${key}: plataforma chat_sdk invalida ou em falta para fornecer segredos`,
        400,
      );
    }
    const body = channelSecretPayloads[key] as Record<string, unknown>;
    const withPlatform = { ...body, platform: body['platform'] ?? plat };
    const payload = parseChatSdkSecretsBody(plat, withPlatform);
    c.secretsEncrypted = channelSecretsService.encryptPayload(payload) as TTeamExportChannelFullSnapshot['secretsEncrypted'];
    delete (c as { secretRequired?: boolean }).secretRequired;
    return c;
  });
  p['channelsFull'] = newFull;
  return p;
}
