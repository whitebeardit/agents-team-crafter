/** Evento global quando access/refresh deixam de ser válidos (evita depender de `clearAuth` no-op em páginas). */
export const SESSION_LOST_EVENT = "teama:session-lost"

export function emitSessionLost() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT))
}
