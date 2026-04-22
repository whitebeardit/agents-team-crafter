import { PartyModel } from './party.model.js';

/**
 * Garante no MongoDB todos os índices definidos no schema Party, incluindo o único
 * parcial `{ workspaceId, phone}` quando `phone` é string não vazia.
 * Idempotente: `createIndexes` só cria o que falta.
 */
export async function ensurePartyIndexes(): Promise<void> {
  await PartyModel.createIndexes();
}
