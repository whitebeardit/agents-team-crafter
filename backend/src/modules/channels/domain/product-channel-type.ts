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
