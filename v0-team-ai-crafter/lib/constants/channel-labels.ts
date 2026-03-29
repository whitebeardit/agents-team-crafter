import type { ChannelStatus, ChannelType } from "@/lib/types"

export const channelTypeLabels: Record<ChannelType, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  api: "API",
  teams: "Microsoft Teams",
  discord: "Discord",
  gchat: "Google Chat",
  telegram: "Telegram",
  github: "GitHub",
  linear: "Linear",
}

export const channelStatusLabels: Record<ChannelStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  pending: "Pendente",
}
