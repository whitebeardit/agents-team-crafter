/** Plataformas Chat SDK (nome do adapter / segmento de URL). */
export const CHAT_SDK_PLATFORMS = [
  'slack',
  'discord',
  'teams',
  'telegram',
  'gchat',
  'github',
  'linear',
  'whatsapp',
] as const;

export type EChatSdkPlatform = (typeof CHAT_SDK_PLATFORMS)[number];

export function isChatSdkPlatform(s: string): s is EChatSdkPlatform {
  return (CHAT_SDK_PLATFORMS as readonly string[]).includes(s);
}
