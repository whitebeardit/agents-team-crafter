import { getBusinessActionPreset } from './business-action-presets.js';

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
  for (const key of required) {
    const v = obj[key];
    if (v === undefined || v === null) {
      missing.push(key);
      continue;
    }
    if (typeof v === 'string' && v.trim() === '') {
      missing.push(key);
    }
  }
  return missing.length > 0 ? { ok: false, missingFields: missing } : { ok: true };
}
