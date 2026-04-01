/**
 * Gera um ID estável para idempotência.
 *
 * `crypto.randomUUID` pode não existir em alguns browsers/contexts (ex.: HTTP não seguro via IP).
 * Este helper usa, em ordem:
 * - `crypto.randomUUID()`
 * - `crypto.getRandomValues()` para gerar UUID v4 manualmente
 * - fallback baseado em tempo + Math.random
 */
export function createOperationId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID()
  }

  if (c && typeof c.getRandomValues === "function") {
    const b = new Uint8Array(16)
    c.getRandomValues(b)
    // UUID v4: set version and variant bits.
    b[6] = (b[6]! & 0x0f) | 0x40
    b[8] = (b[8]! & 0x3f) | 0x80
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `op-${Date.now()}-${Math.random().toString(16).slice(2, 18)}`
}
