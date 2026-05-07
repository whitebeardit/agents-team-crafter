import { getBusinessActionPreset } from './business-action-presets.js';

const ALTERNATIVE_REQUIRED_FIELDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  care_create_subject: {
    partyId: ['phone'],
  },
  package_sell_to_party: { partyId: ['phone'] },
  package_list_by_party: { partyId: ['phone'] },
  attendance_register_session: { partyId: ['phone'] },
  attendance_list_by_party: { partyId: ['phone'] },
  attendance_get_party_care_summary: { partyId: ['phone'] },
  schedule_create_appointment: { partyId: ['phone'] },
  schedule_list_appointments_by_party: { partyId: ['phone'] },
  patient_operational_overview: { partyId: ['phone'] },
  finance_create_receivable: { partyId: ['phone'] },
  finance_customer_financial_summary: { partyId: ['phone'] },
  crm_get_party_summary: { partyId: ['phone'] },
  clinical_open_encounter: { partyId: ['phone'] },
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
  if (missing.length > 0) return { ok: false, missingFields: missing };

  if (actionId === 'package_sell_to_party' && obj) {
    const productSlug = typeof obj.productSlug === 'string' ? obj.productSlug.trim() : '';
    const packageName = typeof obj.packageName === 'string' ? obj.packageName.trim() : '';
    const unitsTotal = Number(obj.unitsTotal);
    if (!productSlug && (!packageName || Number.isNaN(unitsTotal) || unitsTotal < 1)) {
      return { ok: false, missingFields: ['packageName', 'unitsTotal'] };
    }
  }

  return { ok: true };
}
