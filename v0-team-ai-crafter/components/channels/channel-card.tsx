"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, Hash, Mail, Globe, Settings, RefreshCw, Power, Trash2 } from "lucide-react"
import type { Channel } from "@/lib/types"

interface ChannelCardProps {
  channel: Channel
  onConfigure?: (channel: Channel) => void
  onTest?: (channel: Channel) => void
  onToggle?: (channel: Channel) => void
  onRemove?: (channel: Channel) => void
}

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  slack: Hash,
  email: Mail,
  api: Globe,
  teams: Hash,
  discord: Hash,
  gchat: Hash,
  telegram: MessageSquare,
  github: Globe,
  linear: Globe,
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  api: "API REST",
  teams: "Microsoft Teams",
  discord: "Discord",
  gchat: "Google Chat",
  telegram: "Telegram",
  github: "GitHub",
  linear: "Linear",
}

const statusColors = {
  connected: "bg-success/10 text-success border-success/20",
  disconnected: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
}

const statusLabels = {
  connected: "Conectado",
  disconnected: "Desconectado",
  pending: "Pendente",
}

export function ChannelCard({
  channel,
  onConfigure,
  onTest,
  onToggle,
  onRemove,
}: ChannelCardProps) {
  const Icon = channelIcons[channel.type] || Globe

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                channel.status === "connected"
                  ? "bg-success/10"
                  : channel.status === "pending"
                  ? "bg-warning/10"
                  : "bg-secondary"
              }`}
            >
              <Icon
                className={`w-6 h-6 ${
                  channel.status === "connected"
                    ? "text-success"
                    : channel.status === "pending"
                    ? "text-warning"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{channel.name}</h3>
              <p className="text-sm text-muted-foreground">
                {channelLabels[channel.type]}
                {channel.provider === "chat_sdk" && channel.platform
                  ? ` · Chat SDK (${channel.platform})`
                  : channel.provider === "chat_sdk"
                    ? " · Chat SDK"
                    : null}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={statusColors[channel.status]}>
            {statusLabels[channel.status]}
          </Badge>
        </div>

        {/* Config preview */}
        {channel.config && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-sm">
            {Object.entries(channel.config)
              .slice(0, 2)
              .map(([key, value]) => (
                <p key={key} className="text-muted-foreground truncate">
                  <span className="font-medium capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </span>{" "}
                  {typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value)}
                </p>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onConfigure?.(channel)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          {channel.status === "connected" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTest?.(channel)}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant={channel.status === "connected" ? "ghost" : "default"}
            size="icon"
            onClick={() => onToggle?.(channel)}
          >
            <Power className="w-4 h-4" />
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemove(channel)}
              type="button"
              aria-label={`Remover canal ${channel.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
