import { getBusinessActionPreset } from './business-action-presets.js';

const ALTERNATIVE_REQUIRED_FIELDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  care_create_subject: {
    partyId: ['phone'],
  },
};

/**
 * Valida campos `required` do `inputSchema` JSON Schema do preset (Loop 87).
 * Strings vazias contam como ausentes.
 */
export function validateBusinessActionInput(
  actionId: string,
  input: unknown,
): { ok: true } | { ok: false; missingFields: string[] } {
  const preset = getBusinessActionPreset(actionId);
  const raw = preset?.inputSchema;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: true };
  const schema = raw as { required?: string[] };
  const required = schema.required;
  if (!required?.length) return { ok: true };

  const obj =
    input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  if (!obj) {
    return { ok: false, missingFields: [...required] };
  }
  const missing: string[] = [];
  const alternatives = ALTERNATIVE_REQUIRED_FIELDS[actionId] ?? {};
  for (const key of required) {
    const v = obj[key];
    const hasValue = !(v === undefined || v === null || (typeof v === 'string' && v.trim() === ''));
    if (hasValue) continue;

    const alternativeKeys = alternatives[key] ?? [];
    const hasAlternative = alternativeKeys.some((altKey) => {
      const altValue = obj[altKey];
      return !(altValue === undefined || altValue === null || (typeof altValue === 'string' && altValue.trim() === ''));
    });
    if (!hasAlternative) {
      missing.push(key);
    }
  }
  return missing.length > 0 ? { ok: false, missingFields: missing } : { ok: true };
}
