"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Radio, MessageSquare, Hash, Mail, Globe } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { ChannelCard } from "@/components/channels/channel-card"
import { ChannelConfigureDialog } from "@/components/channels/channel-configure-dialog"
import type { Channel, ChannelType } from "@/lib/types"
import { toast } from "sonner"
import { ApiError, createApiClient } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { channelTypeLabels } from "@/lib/constants/channel-labels"
import {
  CHAT_SDK_PLATFORMS,
  chatSdkPlatformLabels,
  type ChatSdkPlatform,
} from "@/lib/constants/chat-sdk-platforms"

const availableChannels: { type: ChannelType; name: string; icon: React.ElementType; description: string }[] = [
  {
    type: "whatsapp",
    name: "WhatsApp Business",
    icon: MessageSquare,
    description: "Conecte sua conta do WhatsApp Business API",
  },
  {
    type: "slack",
    name: "Slack",
    icon: Hash,
    description: "Integre com seu workspace do Slack",
  },
  {
    type: "email",
    name: "Email",
    icon: Mail,
    description: "Configure integração via SMTP/IMAP",
  },
  {
    type: "api",
    name: "API REST",
    icon: Globe,
    description: "Conecte via API REST personalizada",
  },
]

function defaultRoutingConfig(platform: ChatSdkPlatform): Record<string, string> {
  switch (platform) {
    case "slack":
      return { slackTeamId: "" }
    case "discord":
      return { discordGuildId: "" }
    case "teams":
      return { teamsTenantId: "" }
    case "telegram":
      return {}
    case "gchat":
      return { gchatSpaceName: "" }
    case "github":
      return { githubRepoFullName: "" }
    case "linear":
      return { linearTeamId: "" }
    case "whatsapp":
      return { whatsappPhoneNumberId: "" }
    default:
      return {}
  }
}

function platformToChannelType(platform: ChatSdkPlatform): ChannelType {
  return platform as ChannelType
}

export default function ChannelsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [channels, setChannels] = useState<Channel[]>([])
  const [configureChannel, setConfigureChannel] = useState<Channel | null>(null)
  const [configureOpen, setConfigureOpen] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  const refreshChannels = useCallback(async () => {
    if (!api) return
    const res = await api.get<Channel[]>("/channels")
    setChannels(res.data)
  }, [api])

  useEffect(() => {
    if (!api) return
    let cancelled = false
    void (async () => {
      const res = await api.get<Channel[]>("/channels")
      if (!cancelled) setChannels(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  const connectedChannels = channels.filter((c) => c.status === "connected")
  const pendingChannels = channels.filter((c) => c.status === "pending")
  const disconnectedChannels = channels.filter((c) => c.status === "disconnected")

  const handleConfigure = async (channel: Channel) => {
    if (!api) return
    try {
      const res = await api.get<Channel>(`/channels/${channel.id}`)
      setConfigureChannel(res.data)
      setConfigureOpen(true)
    } catch {
      toast.error("Não foi possível carregar o canal")
    }
  }

  const handleTest = async (channel: Channel) => {
    if (!api) return
    try {
      const res = await api.post<{ status: string; latency: number; message: string }>(
        `/channels/${channel.id}/test`,
        {},
      )
      toast.success(`${res.data.message} (${res.data.latency}ms)`)
    } catch {
      toast.error(`Falha ao testar "${channel.name}"`)
    }
  }

  const handleToggle = async (channel: Channel) => {
    if (!api) return
    try {
      if (channel.status === "connected") {
        await api.post(`/channels/${channel.id}/disconnect`, {})
        toast.info(`"${channel.name}" desconectado`)
      } else {
        await api.post(`/channels/${channel.id}/connect`, {})
        toast.success(`"${channel.name}" conectado!`)
      }
      await refreshChannels()
    } catch {
      toast.error("Falha ao atualizar canal")
    }
  }

  const handleAddChannel = async (type: ChannelType) => {
    if (!api) return
    try {
      const body =
        type === "slack"
          ? {
              type,
              name: `${channelTypeLabels[type]} (Chat SDK)`,
              provider: "chat_sdk" as const,
              platform: "slack",
              config: defaultRoutingConfig("slack"),
            }
          : { type, name: `${channelTypeLabels[type]} (novo)`, config: {} }
      await api.post("/channels", body)
      await refreshChannels()
      toast.success(`Canal ${channelTypeLabels[type]} criado`)
    } catch {
      toast.error("Falha ao criar canal")
    }
  }

  const handleAddChatSdk = async (platform: ChatSdkPlatform) => {
    if (!api) return
    try {
      const type = platformToChannelType(platform)
      await api.post("/channels", {
        type,
        name: `${chatSdkPlatformLabels[platform]} (Chat SDK)`,
        provider: "chat_sdk",
        platform,
        config: defaultRoutingConfig(platform),
      })
      await refreshChannels()
      toast.success(`Canal ${chatSdkPlatformLabels[platform]} criado`)
    } catch {
      toast.error("Falha ao criar canal Chat SDK")
    }
  }

  const confirmDeleteChannel = async () => {
    if (!api || !channelToDelete) return
    setDeleteInProgress(true)
    try {
      await api.del(`/channels/${channelToDelete.id}`)
      toast.success(`Canal "${channelToDelete.name}" removido`)
      setChannelToDelete(null)
      await refreshChannels()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const teams = (err.details.teams as Array<{ id: string; name: string }> | undefined) ?? []
          const names = teams.map((t) => t.name).filter(Boolean).join(", ")
          toast.error(
            names
              ? `Remova o canal dos times antes de excluir: ${names}`
              : err.message || "Canal ainda vinculado a times",
          )
        } else if (err.status === 403) {
          toast.error("Sem permissão para remover canais (apenas administradores).")
        } else {
          toast.error(err.message || "Falha ao remover o canal")
        }
      } else {
        toast.error("Falha ao remover o canal")
      }
    } finally {
      setDeleteInProgress(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Canais</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os canais de comunicação dos seus times
          </p>
        </div>
      </div>

      <Alert>
        <MessageSquare className="h-4 w-4" />
        <AlertTitle>Duas formas de criar canais</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            <strong className="text-foreground">Chat SDK — plataformas</strong>: um canal por plataforma (Slack,
            Discord, Teams, …) com <code className="text-xs">provider=chat_sdk</code>, roteamento e segredos proprios
            em <strong>Configurar</strong>. E o caminho para integrar o runtime dos agentes com mensagens nessas apps.
          </p>
          <p>
            <strong className="text-foreground">Canais genéricos</strong>: modelos por tipo (WhatsApp, email, API REST,
            …) para fluxos mais amplos. O atalho &quot;Slack&quot; aqui cria ja um canal Chat SDK de Slack; use a grelha
            acima para Discord, Teams ou outras.
          </p>
          <p className="text-muted-foreground">
            Segredos do workspace (fallback) e OpenAI estao em{" "}
            <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
              Configuracoes → Integracoes
            </Link>
            . Preferencias de alertas por email/Slack/Discord ficam em{" "}
            <Link href="/settings?tab=notifications" className="text-primary underline-offset-4 hover:underline">
              Notificacoes
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <Radio className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{connectedChannels.length}</p>
                <p className="text-sm text-muted-foreground">Conectados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Radio className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingChannels.length}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-secondary">
                <Radio className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{disconnectedChannels.length}</p>
                <p className="text-sm text-muted-foreground">Desconectados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Canais Configurados</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onConfigure={handleConfigure}
              onTest={handleTest}
              onToggle={handleToggle}
              onRemove={(c) => setChannelToDelete(c)}
            />
          ))}
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Chat SDK — plataformas</CardTitle>
          <CardDescription>
            Inclui Slack, Discord, Microsoft Teams, Telegram, Google Chat, GitHub, Linear e WhatsApp Cloud. Cada botao
            cria um canal com <code className="text-xs">provider=chat_sdk</code> e <code className="text-xs">platform</code>{" "}
            correspondente; em <strong>Configurar</strong> define IDs de equipa/guild e tokens (cifrados com{" "}
            <code className="text-xs">ENCRYPTION_MASTER_KEY</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CHAT_SDK_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => handleAddChatSdk(platform)}
                className="flex flex-col items-center p-4 rounded-lg border border-dashed border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <AgentWhitebeardIcon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-medium text-foreground text-sm">{chatSdkPlatformLabels[platform]}</h4>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Canais genéricos</CardTitle>
          <CardDescription>
            Modelos por tipo de integracao. O cartao Slack abre um fluxo Chat SDK; os restantes sao entradas genericas
            (email/SMTP, API REST, WhatsApp) que pode alinhar ao seu provedor. Use <strong>Testar</strong> no cartao do
            canal apos configurar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {availableChannels.map((channel) => (
              <button
                key={channel.type}
                type="button"
                onClick={() => handleAddChannel(channel.type)}
                className="flex flex-col items-center p-6 rounded-lg border border-dashed border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <channel.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium text-foreground">{channel.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{channel.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {api && (
        <ChannelConfigureDialog
          channel={configureChannel}
          open={configureOpen}
          onOpenChange={setConfigureOpen}
          api={api}
          onSaved={() => void refreshChannels()}
        />
      )}

      <AlertDialog
        open={!!channelToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteInProgress) setChannelToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover canal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground text-sm">
                <p>
                  Esta ação não pode ser desfeita. O canal{" "}
                  <span className="font-medium text-foreground">
                    {channelToDelete?.name ?? ""}
                  </span>{" "}
                  e os segredos cifrados associados serão apagados. Integrações e webhooks que usam este
                  canal deixarão de funcionar.
                </p>
                <p>
                  Se o canal estiver vinculado a algum time, a exclusão será bloqueada até você removê-lo
                  na configuração do time.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteInProgress}
              onClick={() => void confirmDeleteChannel()}
            >
              {deleteInProgress ? "Removendo…" : "Remover canal"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
