/**
 * Formato de ID de modelo no catálogo OpenRouter (`provedor/modelo`).
 * Inclui sufixos `:free`, alias com `~`, versões com dígitos e pontos.
 */
export const OPENROUTER_MODEL_ID_PATTERN = /^[\w.~-]+\/[\w.~:-]+$/;

export function isOpenRouterStyleModelId(raw: string | undefined | null): boolean {
  const t = raw?.trim();
  if (!t) return false;
  return OPENROUTER_MODEL_ID_PATTERN.test(t);
}
