/**
 * CRM: telefone persistido apenas com dígitos (E.164 sem símbolos), ex. +55 (79) 9 88228535 → 5579988228535.
 */
export function normalizePartyPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** E.164 pode ir até ~15 dígitos; evita lixo acidental. */
const MAX_PARTY_PHONE_DIGITS = 20;

export function assertPersistablePartyPhone(digits: string): void {
  if (!digits) {
    throw new Error('PHONE_EMPTY');
  }
  if (digits.length < 8) {
    throw new Error('PHONE_TOO_SHORT');
  }
  if (digits.length > MAX_PARTY_PHONE_DIGITS) {
    throw new Error('PHONE_TOO_LONG');
  }
}
