"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Channel } from "@/lib/types"
import type { ChatSdkPlatform } from "@/lib/constants/chat-sdk-platforms"
import { chatSdkPlatformLabels } from "@/lib/constants/chat-sdk-platforms"
import { channelTypeLabels } from "@/lib/constants/channel-labels"
import { ApiError, type createApiClient } from "@/lib/api/client"

type ApiClient = ReturnType<typeof createApiClient>

interface ChannelConfigureDialogProps {
  channel: Channel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  api: ApiClient
  onSaved: () => void
}

export function ChannelConfigureDialog({
  channel,
  open,
  onOpenChange,
  api,
  onSaved,
}: ChannelConfigureDialogProps) {
  const [routingJson, setRoutingJson] = useState("{}")
  const [displayName, setDisplayName] = useState("")
  const [saving, setSaving] = useState(false)
  const [registeringWebhook, setRegisteringWebhook] = useState(false)

  const platform = (channel?.platform ?? "") as ChatSdkPlatform | ""
  const isChatSdk = channel?.provider === "chat_sdk" && platform

  useEffect(() => {
    if (!channel || !open) return
    setRoutingJson(JSON.stringify(channel.config ?? {}, null, 2))
    setDisplayName(channel.name)
  }, [channel, open])

  if (!channel) return null

  const formTrim = (form: FormData, key: string) => String(form.get(key) ?? "").trim()

  /** True when the user filled the minimum fields required to PUT /secrets for this platform. */
  const secretsProvided = (form: FormData, p: ChatSdkPlatform): boolean => {
    switch (p) {
      case "slack":
        return formTrim(form, "signingSecret").length > 0 && formTrim(form, "botToken").length > 0
      case "discord":
        return formTrim(form, "botToken").length > 0 && formTrim(form, "publicKey").length > 0
      case "teams":
        return formTrim(form, "appId").length > 0 && formTrim(form, "appPassword").length > 0
      case "telegram":
        return formTrim(form, "botToken").length > 0
      case "gchat":
        return formTrim(form, "credentialsJson").length > 0
      case "github":
        return formTrim(form, "webhookSecret").length > 0
      case "linear":
        return formTrim(form, "webhookSecret").length > 0
      case "whatsapp":
        return (
          formTrim(form, "accessToken").length > 0 &&
          formTrim(form, "appSecret").length > 0 &&
          formTrim(form, "verifyToken").length > 0
        )
      default:
        return false
    }
  }

  const saveChannelMeta = async (): Promise<boolean> => {
    const trimmed = displayName.trim()
    if (!trimmed) {
      toast.error("Indique um nome ou etiqueta para o canal")
      return false
    }
    let config: Record<string, unknown>
    try {
      config = JSON.parse(routingJson) as Record<string, unknown>
    } catch {
      toast.error("JSON de roteamento inválido")
      return false
    }
    await api.put(`/channels/${channel.id}`, { name: trimmed, config })
    return true
  }

  const saveSecretsSlack = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "slack",
      signingSecret: String(form.get("signingSecret") ?? ""),
      botToken: String(form.get("botToken") ?? ""),
    })
  }

  const saveSecretsDiscord = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "discord",
      botToken: String(form.get("botToken") ?? ""),
      publicKey: String(form.get("publicKey") ?? ""),
      applicationId: String(form.get("applicationId") ?? "") || undefined,
    })
  }

  const saveSecretsTeams = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "teams",
      appId: String(form.get("appId") ?? ""),
      appPassword: String(form.get("appPassword") ?? ""),
      appTenantId: String(form.get("appTenantId") ?? "") || undefined,
    })
  }

  const saveSecretsTelegram = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "telegram",
      botToken: String(form.get("botToken") ?? ""),
      secretToken: String(form.get("secretToken") ?? "") || undefined,
    })
  }

  const saveSecretsGchat = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "gchat",
      credentialsJson: String(form.get("credentialsJson") ?? ""),
      googleChatProjectNumber: String(form.get("googleChatProjectNumber") ?? "") || undefined,
      impersonateUser: String(form.get("impersonateUser") ?? "") || undefined,
    })
  }

  const saveSecretsGithub = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "github",
      webhookSecret: String(form.get("webhookSecret") ?? ""),
      token: String(form.get("token") ?? "") || undefined,
      appId: String(form.get("appId") ?? "") || undefined,
      privateKey: String(form.get("privateKey") ?? "") || undefined,
      installationId: form.get("installationId")
        ? Number(form.get("installationId"))
        : undefined,
    })
  }

  const saveSecretsLinear = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "linear",
      webhookSecret: String(form.get("webhookSecret") ?? ""),
      apiKey: String(form.get("apiKey") ?? "") || undefined,
      accessToken: String(form.get("accessToken") ?? "") || undefined,
      clientId: String(form.get("clientId") ?? "") || undefined,
      clientSecret: String(form.get("clientSecret") ?? "") || undefined,
    })
  }

  const saveSecretsWhatsapp = async (form: FormData) => {
    await api.put(`/channels/${channel.id}/secrets`, {
      platform: "whatsapp",
      accessToken: String(form.get("accessToken") ?? ""),
      appSecret: String(form.get("appSecret") ?? ""),
      verifyToken: String(form.get("verifyToken") ?? ""),
    })
  }

  const handleRegisterTelegramWebhook = async () => {
    if (!channel || platform !== "telegram") return
    setRegisteringWebhook(true)
    try {
      const res = await api.post<{
        webhookUrl: string
        setWebhook: { ok?: boolean; description?: string }
        webhookInfo: { ok?: boolean; result?: { url?: string; pending_update_count?: number } }
      }>(`/channels/${channel.id}/telegram/register-webhook`)
      const info = res.data.webhookInfo?.result as { url?: string } | undefined
      toast.success(
        info?.url
          ? `Webhook registado: ${info.url}`
          : "Webhook registado no Telegram (setWebhook OK)",
      )
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao registar webhook"
      toast.error(msg)
    } finally {
      setRegisteringWebhook(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isChatSdk || !platform) {
      toast.error("Canal não é Chat SDK")
      return
    }
    setSaving(true)
    const form = new FormData(e.currentTarget)
    try {
      const metaOk = await saveChannelMeta()
      if (!metaOk) return

      if (secretsProvided(form, platform)) {
        switch (platform) {
          case "slack":
            await saveSecretsSlack(form)
            break
          case "discord":
            await saveSecretsDiscord(form)
            break
          case "teams":
            await saveSecretsTeams(form)
            break
          case "telegram":
            await saveSecretsTelegram(form)
            break
          case "gchat":
            await saveSecretsGchat(form)
            break
          case "github":
            await saveSecretsGithub(form)
            break
          case "linear":
            await saveSecretsLinear(form)
            break
          case "whatsapp":
            await saveSecretsWhatsapp(form)
            break
          default:
            toast.error("Plataforma não suportada")
            return
        }
      }

      toast.success("Salvo com sucesso")
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Falha ao salvar (verifique permissão admin e ENCRYPTION_MASTER_KEY no servidor)")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar canal</DialogTitle>
          <DialogDescription>
            {channel.name} —{" "}
            {isChatSdk && platform
              ? `${chatSdkPlatformLabels[platform]} (Chat SDK)`
              : channelTypeLabels[channel.type]}
          </DialogDescription>
        </DialogHeader>

        {channel.webhookUrl && (
          <div className="space-y-1">
            <Label>URL do webhook</Label>
            <Input readOnly value={channel.webhookUrl} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Slack usa o path sem ID do canal; demais plataformas incluem o ID do canal na URL.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="channel-display-name">Nome / etiqueta</Label>
            <Input
              id="channel-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Telegram — atendimento clínica A"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Nome para distinguir este canal dos outros no workspace (não altera o bot ou a conta na plataforma).
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="routing-json">Config de roteamento (JSON)</Label>
            <textarea
              id="routing-json"
              className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={routingJson}
              onChange={(e) => setRoutingJson(e.target.value)}
              placeholder='{"slackTeamId":"T…"}'
            />
            <p className="text-xs text-muted-foreground">
              Ex.: slackTeamId, discordGuildId, whatsappPhoneNumberId, etc.
            </p>
          </div>

          {isChatSdk && platform === "slack" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="signingSecret">Signing secret</Label>
                <Input id="signingSecret" name="signingSecret" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="botToken">Bot token (xoxb-…)</Label>
                <Input id="botToken" name="botToken" type="password" autoComplete="off" />
              </div>
            </>
          )}

          {isChatSdk && platform === "discord" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="botToken">Bot token</Label>
                <Input id="botToken" name="botToken" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="publicKey">Public key (Ed25519 hex)</Label>
                <Input id="publicKey" name="publicKey" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="applicationId">Application ID (opcional)</Label>
                <Input id="applicationId" name="applicationId" />
              </div>
            </>
          )}

          {isChatSdk && platform === "teams" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="appId">App ID</Label>
                <Input id="appId" name="appId" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appPassword">App password</Label>
                <Input id="appPassword" name="appPassword" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appTenantId">Tenant ID (opcional)</Label>
                <Input id="appTenantId" name="appTenantId" />
              </div>
            </>
          )}

          {isChatSdk && platform === "telegram" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="botToken">Bot token</Label>
                <Input id="botToken" name="botToken" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="secretToken">Secret token (opcional)</Label>
                <Input id="secretToken" name="secretToken" type="password" autoComplete="off" />
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Guarde os segredos antes de registar o webhook. O URL enviado ao Telegram usa o{" "}
                  <code className="text-xs">Host</code> deste pedido — em produção, aceda à app pelo domínio
                  público (ou ajuste o proxy) para o Telegram receber HTTPS correto.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={registeringWebhook}
                  onClick={() => void handleRegisterTelegramWebhook()}
                >
                  {registeringWebhook ? "A registar…" : "Registar webhook no Telegram"}
                </Button>
              </div>
            </>
          )}

          {isChatSdk && platform === "gchat" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="credentialsJson">Service account JSON</Label>
                <textarea
                  id="credentialsJson"
                  name="credentialsJson"
                  className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-xs font-mono"
                  placeholder='{"client_email":"...","private_key":"..."}'
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="googleChatProjectNumber">Project number (opcional)</Label>
                <Input id="googleChatProjectNumber" name="googleChatProjectNumber" />
              </div>
            </>
          )}

          {isChatSdk && platform === "github" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="webhookSecret">Webhook secret</Label>
                <Input id="webhookSecret" name="webhookSecret" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="token">PAT (opcional)</Label>
                <Input id="token" name="token" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appId">GitHub App ID (opcional)</Label>
                <Input id="appId" name="appId" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="privateKey">Private key PEM (opcional)</Label>
                <textarea
                  id="privateKey"
                  name="privateKey"
                  className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="installationId">Installation ID (opcional)</Label>
                <Input id="installationId" name="installationId" type="number" />
              </div>
            </>
          )}

          {isChatSdk && platform === "linear" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="webhookSecret">Webhook signing secret</Label>
                <Input id="webhookSecret" name="webhookSecret" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apiKey">API key (opcional)</Label>
                <Input id="apiKey" name="apiKey" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="accessToken">OAuth access token (opcional)</Label>
                <Input id="accessToken" name="accessToken" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="clientId">OAuth client ID (opcional)</Label>
                <Input id="clientId" name="clientId" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="clientSecret">OAuth client secret (opcional)</Label>
                <Input id="clientSecret" name="clientSecret" type="password" autoComplete="off" />
              </div>
            </>
          )}

          {isChatSdk && platform === "whatsapp" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="accessToken">Access token</Label>
                <Input id="accessToken" name="accessToken" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appSecret">App secret</Label>
                <Input id="appSecret" name="appSecret" type="password" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="verifyToken">Verify token</Label>
                <Input id="verifyToken" name="verifyToken" type="password" autoComplete="off" />
              </div>
            </>
          )}

          {channel.secretsMasked && Object.keys(channel.secretsMasked).length > 0 && (
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Segredos atuais (mascarados)</p>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(channel.secretsMasked, null, 2)}
              </pre>
            </div>
          )}

          {isChatSdk && (
            <p className="text-xs text-muted-foreground">
              Para guardar só o nome ou o JSON, deixe os campos de segredo vazios — os segredos já armazenados mantêm-se.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !isChatSdk}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
