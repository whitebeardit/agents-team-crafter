/** Limite por frase (utilizador / planner). */
export const EXAMPLE_USER_PHRASE_MAX_LEN = 200;

/** Máximo de frases persistidas por agente. */
export const EXAMPLE_USER_PHRASE_MAX_COUNT = 6;

/** Mínimo exigido no JSON do planner para cada especialista. */
export const PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN = 2;

export function normalizeExampleUserPhrases(phrases: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of phrases ?? []) {
    const t = raw.trim().slice(0, EXAMPLE_USER_PHRASE_MAX_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= EXAMPLE_USER_PHRASE_MAX_COUNT) break;
  }
  return out;
}
