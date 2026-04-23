import { z } from 'zod';

/**
 * Tipos de canal alinhados ao modelo `Channel` (Mongo) e às rotas de canais.
 * Inclui plataformas Chat SDK (`telegram`, `slack`, …) e nativos (`email`, `api`).
 */
export const PRODUCT_CHANNEL_TYPES = [
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
] as const;

export type EProductChannelType = (typeof PRODUCT_CHANNEL_TYPES)[number];

export const productChannelTypeSchema = z.enum(PRODUCT_CHANNEL_TYPES);

const PRODUCT_CHANNEL_SLUGS = new Set<string>(PRODUCT_CHANNEL_TYPES);

/**
 * Mapeia texto livre do briefing/descoberta (ex.: "Web/App", "API interna") para o slug do produto.
 * Usado no gate de adequação e na normalização do briefing; `undefined` se não for reconhecível.
 */
export function resolveChannelHintToProductType(hint: string | undefined): EProductChannelType | undefined {
  if (!hint?.trim()) return undefined;
  const s = hint.trim().toLowerCase();
  if (PRODUCT_CHANNEL_SLUGS.has(s)) return s as EProductChannelType;
  if (s.includes('whatsapp') || s.includes('zap') || s === 'wa') return 'whatsapp';
  if (s.includes('telegram')) return 'telegram';
  if (s.includes('slack')) return 'slack';
  if (s.includes('discord')) return 'discord';
  if (s.includes('teams') || s.includes('microsoft teams')) return 'teams';
  if (s.includes('gchat') || s.includes('google chat')) return 'gchat';
  if (s.includes('github')) return 'github';
  if (s.includes('linear')) return 'linear';
  if (s.includes('email') || s.includes('e-mail') || s.includes('correio')) return 'email';
  if (
    s.includes('api') ||
    s.includes('web') ||
    s.includes('rest') ||
    s.includes('http') ||
    s === 'site' ||
    s.includes('app')
  ) {
    return 'api';
  }
  return undefined;
}
