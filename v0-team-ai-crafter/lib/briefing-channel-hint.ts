/**
 * Espelha `resolveChannelHintToProductType` do backend (`product-channel-type.ts`).
 * Manter alinhado ao mapear novos sinónimos.
 */
const PRODUCT_CHANNEL_SLUGS = new Set([
  "whatsapp",
  "slack",
  "email",
  "api",
  "teams",
  "discord",
  "gchat",
  "telegram",
  "github",
  "linear",
])

export function resolveChannelHintToProductType(hint: string | undefined): string | undefined {
  if (!hint?.trim()) return undefined
  const s = hint.trim().toLowerCase()
  if (PRODUCT_CHANNEL_SLUGS.has(s)) return s
  if (s.includes("whatsapp") || s.includes("zap") || s === "wa") return "whatsapp"
  if (s.includes("telegram")) return "telegram"
  if (s.includes("slack")) return "slack"
  if (s.includes("discord")) return "discord"
  if (s.includes("teams") || s.includes("microsoft teams")) return "teams"
  if (s.includes("gchat") || s.includes("google chat")) return "gchat"
  if (s.includes("github")) return "github"
  if (s.includes("linear")) return "linear"
  if (s.includes("email") || s.includes("e-mail") || s.includes("correio")) return "email"
  if (s.includes("api") || s.includes("web") || s.includes("rest") || s.includes("http") || s === "site" || s.includes("app")) {
    return "api"
  }
  return undefined
}
