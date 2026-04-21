type TCrmCreatePartyInput = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

const CREATE_INTENT_RE =
  /\b(cadastre|cadastrar|cadastro|crie|criar|registre|registrar|pode cadastrar|pode criar|ent[aã]o cadastre)\b/i;
const CUSTOMER_REFERENCE_RE = /\b(cliente|customer|party|cadastre ele|cadastre ela|crie ele|crie ela)\b/i;
const REFERENTIAL_CREATE_RE = /\b(pode cadastrar|pode criar|ent[aã]o cadastre|cadastre ele|cadastre ela|crie ele|crie ela)\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EXTRA_NOTE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'CPF',
    pattern:
      /(?:cpf|documento(?: de identifica[cç][aã]o)?(?:\s*\(cpf\))?)\s*[:=-]\s*([^\n]+)/gi,
  },
  { label: 'CNPJ', pattern: /cnpj\s*[:=-]\s*([^\n]+)/gi },
  { label: 'Endere[oç]o', pattern: /endere[cç]o(?: completo)?\s*[:=-]\s*([^\n]+)/gi },
  { label: 'Respons[aá]vel', pattern: /nome do respons[aá]vel\s*[:=-]\s*([^\n]+)/gi },
  { label: 'Data de nascimento', pattern: /data de nascimento\s*[:=-]\s*([^\n]+)/gi },
  { label: 'G[eê]nero', pattern: /g[eê]nero\s*[:=-]\s*([^\n]+)/gi },
  { label: 'Conv[eê]nio', pattern: /conv[eê]nio\s*[:=-]\s*([^\n]+)/gi },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function lastMatch(text: string, pattern: RegExp): string | undefined {
  const matches = [...text.matchAll(pattern)];
  const value = matches.at(-1)?.[1] ?? matches.at(-1)?.[0];
  return typeof value === 'string' && value.trim() ? normalizeWhitespace(value) : undefined;
}

function lastGlobalMatch(text: string, pattern: RegExp): string | undefined {
  const matches = [...text.matchAll(pattern)];
  const value = matches.at(-1)?.[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extractName(text: string): string | undefined {
  const labeledPatterns = [
    /nome completo do cliente\s*[:=-]\s*([^\n]+)/gi,
    /nome do cliente\s*[:=-]\s*([^\n]+)/gi,
    /nome completo\s*[:=-]\s*([^\n]+)/gi,
    /nome\s*[:=-]\s*([^\n]+)/gi,
  ];
  for (const pattern of labeledPatterns) {
    const value = lastMatch(text, pattern);
    if (value) return value;
  }

  const inlineCreate = lastMatch(
    text,
    /(?:cadastre|cadastrar|crie|criar|registre|registrar)(?:\s+(?:o|um|uma))?(?:\s+cliente)?\s*[:,-]?\s*([A-ZÀ-ÿ][^\n,;]+)/gi,
  );
  return inlineCreate;
}

function extractPhone(text: string): string | undefined {
  const labeledPatterns = [
    /telefone de contato\s*[:=-]\s*([^\n]+)/gi,
    /telefone\s*[:=-]\s*([^\n]+)/gi,
    /celular\s*[:=-]\s*([^\n]+)/gi,
    /phone\s*[:=-]\s*([^\n]+)/gi,
    /whatsapp\s*[:=-]\s*([^\n]+)/gi,
  ];
  for (const pattern of labeledPatterns) {
    const value = lastMatch(text, pattern);
    if (value) return value;
  }
  return lastGlobalMatch(text, PHONE_RE);
}

function extractNotes(text: string): string | undefined {
  const notes = EXTRA_NOTE_PATTERNS.map(({ label, pattern }) => {
    const value = lastMatch(text, pattern);
    return value ? `${label}: ${value}` : null;
  }).filter((value): value is string => Boolean(value));
  return notes.length > 0 ? notes.join('\n') : undefined;
}

function mergeTextParts(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n');
}

export function buildCrmUserConversationContext(currentMessage: string, userHistory?: string[]): string {
  return mergeTextParts([...(userHistory ?? []), currentMessage]);
}

export function isCrmCreateIntentMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return CREATE_INTENT_RE.test(trimmed) && (CUSTOMER_REFERENCE_RE.test(trimmed) || REFERENTIAL_CREATE_RE.test(trimmed));
}

export function extractCrmCreatePartyInputFromConversation(contextText: string): TCrmCreatePartyInput {
  const text = contextText.trim();
  if (!text) return {};
  const name = extractName(text);
  const email = lastGlobalMatch(text, EMAIL_RE);
  const phone = extractPhone(text);
  const notes = extractNotes(text);
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function buildCrmCreatePartyDraft(currentMessage: string, userHistory?: string[]): {
  intentClear: boolean;
  input: TCrmCreatePartyInput;
  missingFields: string[];
} {
  const contextText = buildCrmUserConversationContext(currentMessage, userHistory);
  const input = extractCrmCreatePartyInputFromConversation(contextText);
  return {
    intentClear: isCrmCreateIntentMessage(currentMessage),
    input,
    missingFields: input.name ? [] : ['name'],
  };
}

export function hydrateCrmCreatePartyInputFromConversation(
  input: unknown,
  contextText: string,
): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  const extracted = extractCrmCreatePartyInputFromConversation(contextText);
  return {
    ...record,
    ...(typeof record.name === 'string' && record.name.trim() ? {} : extracted.name ? { name: extracted.name } : {}),
    ...(typeof record.email === 'string' && record.email.trim()
      ? {}
      : extracted.email
        ? { email: extracted.email }
        : {}),
    ...(typeof record.phone === 'string' && record.phone.trim()
      ? {}
      : extracted.phone
        ? { phone: extracted.phone }
        : {}),
    ...(typeof record.notes === 'string' && record.notes.trim()
      ? {}
      : extracted.notes
        ? { notes: extracted.notes }
        : {}),
  };
}
