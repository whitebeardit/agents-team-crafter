/**
 * URL absoluta para a página de aceitar convite (Next.js /invite/[inviteId]).
 * Em cliente, usa NEXT_PUBLIC_APP_URL se definido; senão window.location.origin.
 */
export function getInviteAcceptUrl(inviteId: string): string {
  const trimmed = inviteId.trim()
  if (typeof window !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
    const base = (fromEnv || window.location.origin).replace(/\/+$/, "")
    return `${base}/invite/${encodeURIComponent(trimmed)}`
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")
  return base ? `${base}/invite/${encodeURIComponent(trimmed)}` : `/invite/${encodeURIComponent(trimmed)}`
}
