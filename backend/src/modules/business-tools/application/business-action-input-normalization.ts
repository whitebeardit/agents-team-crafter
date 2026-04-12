const DISPLAY_NAME_ALIASES = [
  'displayName',
  'nome',
  'nomeCompleto',
  'nome_completo',
  'nome completo',
  'fullName',
  'full_name',
] as const;

function firstNonEmptyString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeCrmCreatePartyInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...record };

  const displayName = firstNonEmptyString(record, DISPLAY_NAME_ALIASES);
  if (displayName) {
    normalized.displayName = displayName;
  }

  return normalized;
}

export function normalizeBusinessActionInput(actionId: string, input: unknown): unknown {
  if (actionId === 'crm_create_party') {
    return normalizeCrmCreatePartyInput(input);
  }
  return input;
}
