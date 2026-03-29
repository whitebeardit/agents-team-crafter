import type { IEnv } from '../../../config/env.js';
import type { ChannelSecretsService } from '../../channels/application/channel-secrets.service.js';
import type { ChannelDoc } from '../../channels/infra/channel.model.js';

export interface ISlackPlainSecrets {
  signingSecret: string;
  botToken: string;
}

/** Segredos Slack: canal cifrado → workspace → fallback SLACK_* / botTokenEnvKey (demo). */
export function resolveSlackSecretsForChannel(
  channelDoc: ChannelDoc,
  env: IEnv,
  svc: ChannelSecretsService,
  workspaceFallback?: ISlackPlainSecrets | null,
): ISlackPlainSecrets | null {
  const plain = svc.decryptPayload(channelDoc);
  if (plain && plain.platform === 'slack') {
    return { signingSecret: plain.signingSecret, botToken: plain.botToken };
  }
  if (workspaceFallback?.signingSecret && workspaceFallback?.botToken) {
    return workspaceFallback;
  }
  const cfg = (channelDoc.config as Record<string, unknown>) ?? {};
  const botTokenEnvKey =
    typeof cfg.botTokenEnvKey === 'string' ? cfg.botTokenEnvKey : 'SLACK_BOT_TOKEN';
  const botToken = process.env[botTokenEnvKey] ?? process.env.SLACK_BOT_TOKEN ?? '';
  const signingSecret = env.SLACK_SIGNING_SECRET ?? '';
  if (signingSecret.length > 0 && botToken.length > 0) {
    return { signingSecret, botToken };
  }
  return null;
}
