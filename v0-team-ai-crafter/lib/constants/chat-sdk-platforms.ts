/** Plataformas Chat SDK (alinhado ao backend). */
export const CHAT_SDK_PLATFORMS = [
  "slack",
  "discord",
  "teams",
  "telegram",
  "gchat",
  "github",
  "linear",
  "whatsapp",
] as const

export type ChatSdkPlatform = (typeof CHAT_SDK_PLATFORMS)[number]

export const chatSdkPlatformLabels: Record<ChatSdkPlatform, string> = {
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  gchat: "Google Chat",
  github: "GitHub",
  linear: "Linear",
  whatsapp: "WhatsApp (Cloud API)",
}
