"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { WORKSPACE_DEFAULT_LOGO } from "@/lib/constants/workspace"
import { ApiError, createApiClient } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Building2,
  User,
  Bell,
  Shield,
  CreditCard,
  Key,
  Globe,
  Palette,
  Trash2,
  Upload,
  Copy,
  RefreshCw,
  Check,
  Plug,
  ExternalLink,
  Database,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WorkspaceTeamSection } from "@/components/workspace/workspace-team-section"
import type { IUserPreferences } from "@/lib/types"

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_MAX_BYTES = 1024 * 1024

const SETTINGS_TAB_VALUES = [
  "workspace",
  "integrations",
  "profile",
  "notifications",
  "security",
  "billing",
] as const
const LOGO_ACCEPT_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"])

type SettingsWorkspaceState = {
  id: string
  name: string
  logo?: string
  plan?: string
  settings?: Record<string, unknown>
  limits?: unknown
}

type TeamPlanningPolicy = {
  autoBindMode: "inherit" | "enabled" | "disabled"
  autoBindEnabled: boolean
  source: "workspace_enabled" | "workspace_disabled" | "environment_default"
  reusedAgentBindMode: "manual" | "merge"
}

type ProfileApiResponse = {
  id: string
  name: string
  email: string
  avatar?: string
  preferences?: IUserPreferences & Record<string, unknown>
}

type IntegrationsApiData = {
  operationalCatalogTools?: Array<{ id: string; name: string; description: string }>
  secretsMasked: {
    openaiApiKeyConfigured: boolean
    openaiApiKeyMasked?: string
    smtp?: {
      host?: string
      port?: number
      secure?: boolean
      userMasked?: string
      from?: string
      passwordConfigured: boolean
    }
    slack?: {
      signingSecretMasked?: string
      botTokenMasked?: string
      clientIdMasked?: string
      clientSecretMasked?: string
    }
    toolDatabase?: { postgresReadOnlyUrlConfigured: boolean }
    toolCrm?: { restBaseUrl?: string; bearerTokenConfigured: boolean }
    toolCalendar?: { restBaseUrl?: string; authHeaderConfigured: boolean }
    /** Padrao workspace para tool catalog_image_generation quando model=default */
    imageGenerationModel?: "dall-e-2" | "dall-e-3"
  }
}

function toastIntegrationRequestError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      toast.error(
        "Sem permissao: e preciso ser admin ou owner deste workspace (ou admin global para integracoes).",
      )
      return
    }
    if (err.status === 503 && err.code === "CONFIG_ERROR") {
      toast.error(
        err.message ||
          "ENCRYPTION_MASTER_KEY nao configurada no servidor (64 caracteres hex no BFF; openssl rand -hex 32).",
      )
      return
    }
    if (err.message && err.message !== "Request failed") {
      toast.error(err.message)
      return
    }
  }
  toast.error(fallback)
}

function toastApiRequestError(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message && err.message !== "Request failed") {
    toast.error(err.message)
    return
  }
  toast.error(fallback)
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { token, refreshToken, currentWorkspace, bootstrap, refreshSessionUser } = useWorkspaceStore()
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [workspace, setWorkspace] = useState<SettingsWorkspaceState | null>(null)
  const [profile, setProfile] = useState<ProfileApiResponse | null>(null)
  /** `undefined` = não enviar avatar no PUT; string = data URL ou `""` para limpar */
  const [pendingAvatar, setPendingAvatar] = useState<string | undefined>(undefined)

  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; prefix: string; createdAt?: string }>>([])
  const [newApiKeyName, setNewApiKeyName] = useState("")
  const [latestPlainApiKey, setLatestPlainApiKey] = useState<string | null>(null)
  const [apiKeyBusy, setApiKeyBusy] = useState(false)

  const [integrations, setIntegrations] = useState<IntegrationsApiData["secretsMasked"] | null>(null)
  const [intBusy, setIntBusy] = useState(false)
  const [openaiKeyInput, setOpenaiKeyInput] = useState("")
  /** __default__ = sem valor persistido (runtime usa DALL-E 3 se model=default na tool) */
  const [imageGenModelDefault, setImageGenModelDefault] = useState<"__default__" | "dall-e-2" | "dall-e-3">(
    "__default__",
  )
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [smtpFrom, setSmtpFrom] = useState("")
  const [slackSigning, setSlackSigning] = useState("")
  const [slackBot, setSlackBot] = useState("")
  const [slackClientId, setSlackClientId] = useState("")
  const [slackClientSecret, setSlackClientSecret] = useState("")
  const [smtpTestTo, setSmtpTestTo] = useState("")

  const [toolDbPostgresUrl, setToolDbPostgresUrl] = useState("")
  const [toolCrmRestBase, setToolCrmRestBase] = useState("")
  const [toolCrmBearer, setToolCrmBearer] = useState("")
  const [toolCalRestBase, setToolCalRestBase] = useState("")
  const [toolCalAuthHeader, setToolCalAuthHeader] = useState("")
  const [teamPlanPolicy, setTeamPlanPolicy] = useState<TeamPlanningPolicy | null>(null)
  const [teamPlanAutoBindMode, setTeamPlanAutoBindMode] = useState<"inherit" | "enabled" | "disabled">("inherit")
  const [reusedAgentBindMode, setReusedAgentBindMode] = useState<"manual" | "merge">("manual")

  const tabParam = searchParams.get("tab")
  const defaultTab =
    tabParam && (SETTINGS_TAB_VALUES as readonly string[]).includes(tabParam)
      ? tabParam
      : "workspace"

  // Form states
  const [workspaceName, setWorkspaceName] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userBio, setUserBio] = useState("")
  const [prefLocale, setPrefLocale] = useState<IUserPreferences["locale"]>("pt-BR")
  const [prefTheme, setPrefTheme] = useState<IUserPreferences["theme"]>("dark")

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [slackNotifications, setSlackNotifications] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(true)
  const currentPlan = (workspace?.plan ?? "free") as "free" | "pro" | "enterprise"

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const [workspaceRes, profileRes, apiKeysRes, integrationsRes, teamPlanPolicyRes] = await Promise.all([
        api.get<SettingsWorkspaceState>("/settings/workspace"),
        api.get<ProfileApiResponse>("/settings/profile", { tenant: false }),
        api.get<Array<{ id: string; name: string; prefix: string; createdAt?: string }>>("/settings/api-keys"),
        api.get<IntegrationsApiData>("/settings/workspace/integrations").catch((): { data: IntegrationsApiData } => ({
          data: {
            secretsMasked: {
              openaiApiKeyConfigured: false,
            },
            operationalCatalogTools: [],
          },
        })),
        api.get<TeamPlanningPolicy>("/settings/workspace/team-planning-policy").catch((): { data: TeamPlanningPolicy } => ({
          data: {
            autoBindMode: "inherit",
            autoBindEnabled: false,
            source: "environment_default",
            reusedAgentBindMode: "manual",
          },
        })),
      ])
      setWorkspace(workspaceRes.data)
      setProfile(profileRes.data)
      setApiKeys(apiKeysRes.data)
      setIntegrations(integrationsRes.data.secretsMasked)
      setTeamPlanPolicy(teamPlanPolicyRes.data)
      setTeamPlanAutoBindMode(teamPlanPolicyRes.data.autoBindMode)
      setReusedAgentBindMode(teamPlanPolicyRes.data.reusedAgentBindMode)
      const igm = integrationsRes.data.secretsMasked.imageGenerationModel
      setImageGenModelDefault(igm === "dall-e-2" || igm === "dall-e-3" ? igm : "__default__")
      setSmtpTestTo(profileRes.data.email ?? "")
      const sm = integrationsRes.data.secretsMasked.smtp
      if (sm) {
        setSmtpHost(sm.host ?? "")
        setSmtpPort(String(sm.port ?? 587))
        setSmtpSecure(Boolean(sm.secure))
        setSmtpFrom(sm.from ?? "")
      }
      const tm = integrationsRes.data.secretsMasked
      setToolDbPostgresUrl("")
      setToolCrmRestBase(tm.toolCrm?.restBaseUrl ?? "")
      setToolCrmBearer("")
      setToolCalRestBase(tm.toolCalendar?.restBaseUrl ?? "")
      setToolCalAuthHeader("")
      setWorkspaceName(workspaceRes.data.name ?? "")
      setUserName(profileRes.data.name ?? "")
      setUserEmail(profileRes.data.email ?? "")
      setPendingAvatar(undefined)
      const prefs = profileRes.data.preferences ?? {}
      setUserBio(typeof prefs.bio === "string" ? prefs.bio : "")
      const loc = prefs.locale
      setPrefLocale(loc === "en-US" || loc === "es" || loc === "pt-BR" ? loc : "pt-BR")
      const th = prefs.theme
      setPrefTheme(th === "light" || th === "dark" || th === "system" ? th : "dark")
    })()
  }, [token, refreshToken, currentWorkspace])

  const handleWorkspaceLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ""
    if (!file || !token || !currentWorkspace) return

    if (!LOGO_ACCEPT_TYPES.has(file.type)) {
      toast.error("Use PNG, JPG ou SVG.")
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Arquivo muito grande. Maximo 2MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== "string") return
      void (async () => {
        setLogoUploading(true)
        try {
          const api = createApiClient({
            getAuth: () => ({ token, refreshToken }),
            setAuth: () => {},
            clearAuth: () => {},
            getWorkspaceId: () => currentWorkspace.id,
          })
          const res = await api.put<{ id: string; name: string; logo?: string }>(
            `/workspaces/${currentWorkspace.id}`,
            { logo: dataUrl },
            { tenant: false },
          )
          setWorkspace((prev) => (prev ? { ...prev, logo: res.data.logo ?? dataUrl } : prev))
          await bootstrap()
          toast.success("Logo atualizado")
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            toast.error("Apenas owner ou admin podem alterar o logo.")
          } else {
            toast.error("Falha ao atualizar o logo")
          }
        } finally {
          setLogoUploading(false)
        }
      })()
    }
    reader.readAsDataURL(file)
  }

  const handleProfileAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ""
    if (!file || !token) return

    if (!LOGO_ACCEPT_TYPES.has(file.type)) {
      toast.error("Use PNG ou JPG para o avatar.")
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Arquivo muito grande. Maximo 1MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== "string") return
      setPendingAvatar(dataUrl)
      setProfile((prev) => (prev ? { ...prev, avatar: dataUrl } : prev))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveProfileAvatar = () => {
    setPendingAvatar("")
    setProfile((prev) => (prev ? { ...prev, avatar: undefined } : prev))
  }

  const handleSave = async () => {
    if (!userName.trim()) {
      toast.error("Nome nao pode ficar vazio.")
      return
    }
    setSaving(true)
    try {
      if (!token || !currentWorkspace) return
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
      const profileBody: {
        name: string
        preferences: IUserPreferences
        avatar?: string
      } = {
        name: userName.trim(),
        preferences: {
          locale: prefLocale,
          theme: prefTheme,
          bio: userBio.trim() || undefined,
        },
      }
      if (pendingAvatar !== undefined) {
        profileBody.avatar = pendingAvatar
      }
      const [, profilePut] = await Promise.all([
        api.put("/settings/workspace", { name: workspaceName }),
        api.put<ProfileApiResponse & { message: string }>("/settings/profile", profileBody, {
          tenant: false,
        }),
      ])
      const p = profilePut.data
      setProfile({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar: p.avatar,
        preferences: p.preferences ?? {},
      })
      setPendingAvatar(undefined)
      await refreshSessionUser()
      await bootstrap()
      toast.success("Configuracoes salvas com sucesso!")
    } catch (err) {
      toastApiRequestError(err, "Falha ao salvar configuracoes")
    } finally {
      setSaving(false)
    }
  }

  const integrationApi = () => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }

  const saveOpenAiIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", { openaiApiKey: openaiKeyInput })
      setIntegrations(res.data.secretsMasked)
      const igm = res.data.secretsMasked.imageGenerationModel
      setImageGenModelDefault(igm === "dall-e-2" || igm === "dall-e-3" ? igm : "__default__")
      setOpenaiKeyInput("")
      toast.success("Chave OpenAI guardada")
    } catch (err) {
      toastIntegrationRequestError(
        err,
        "Falha ao guardar (precisa ser admin e ENCRYPTION_MASTER_KEY no servidor)",
      )
    } finally {
      setIntBusy(false)
    }
  }

  const saveTeamPlanPolicy = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TeamPlanningPolicy & { message: string }>(
        "/settings/workspace/team-planning-policy",
        {
          autoBindMode: teamPlanAutoBindMode,
          reusedAgentBindMode,
        },
      )
      setTeamPlanPolicy({
        autoBindMode: res.data.autoBindMode,
        autoBindEnabled: res.data.autoBindEnabled,
        source: res.data.source,
        reusedAgentBindMode: res.data.reusedAgentBindMode,
      })
      toast.success("Politica de auto-bind guardada")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar politica de auto-bind")
    } finally {
      setIntBusy(false)
    }
  }

  const clearOpenAiIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", { openaiApiKey: "" })
      setIntegrations(res.data.secretsMasked)
      setOpenaiKeyInput("")
      const igm = res.data.secretsMasked.imageGenerationModel
      setImageGenModelDefault(igm === "dall-e-2" || igm === "dall-e-3" ? igm : "__default__")
      toast.success("Chave OpenAI removida do workspace")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao remover chave")
    } finally {
      setIntBusy(false)
    }
  }

  const saveImageGenerationModelDefault = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
        imageGenerationModel: imageGenModelDefault === "__default__" ? "" : imageGenModelDefault,
      })
      setIntegrations(res.data.secretsMasked)
      const igm = res.data.secretsMasked.imageGenerationModel
      setImageGenModelDefault(igm === "dall-e-2" || igm === "dall-e-3" ? igm : "__default__")
      toast.success("Modelo padrao de imagem guardado")
    } catch (err) {
      toastIntegrationRequestError(
        err,
        "Falha ao guardar (precisa ser admin e ENCRYPTION_MASTER_KEY no servidor)",
      )
    } finally {
      setIntBusy(false)
    }
  }

  const saveSmtpIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
          smtp: {
            host: smtpHost,
            port: Number(smtpPort) || 587,
            secure: smtpSecure,
            user: smtpUser,
            password: smtpPassword,
            from: smtpFrom || undefined,
          },
      })
      setIntegrations(res.data.secretsMasked)
      setSmtpPassword("")
      toast.success("SMTP guardado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar SMTP")
    } finally {
      setIntBusy(false)
    }
  }

  const saveSlackIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
          slack: {
            signingSecret: slackSigning || undefined,
            botToken: slackBot || undefined,
            clientId: slackClientId || undefined,
            clientSecret: slackClientSecret || undefined,
          },
      })
      setIntegrations(res.data.secretsMasked)
      setSlackSigning("")
      setSlackBot("")
      setSlackClientId("")
      setSlackClientSecret("")
      toast.success("Slack guardado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar Slack")
    } finally {
      setIntBusy(false)
    }
  }

  const saveToolDatabaseIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
        toolDatabase: { postgresReadOnlyUrl: toolDbPostgresUrl },
      })
      setIntegrations(res.data.secretsMasked)
      setToolDbPostgresUrl("")
      toast.success("Postgres (somente leitura) guardado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar Postgres para tools")
    } finally {
      setIntBusy(false)
    }
  }

  const saveToolCrmIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
        toolCrm: {
          restBaseUrl: toolCrmRestBase || undefined,
          bearerToken: toolCrmBearer || undefined,
        },
      })
      setIntegrations(res.data.secretsMasked)
      setToolCrmRestBase(res.data.secretsMasked.toolCrm?.restBaseUrl ?? "")
      setToolCrmBearer("")
      toast.success("CRM (REST) guardado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar CRM para tools")
    } finally {
      setIntBusy(false)
    }
  }

  const saveToolCalendarIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<{
        message: string
        secretsMasked: IntegrationsApiData["secretsMasked"]
      }>("/settings/workspace/integrations", {
        toolCalendar: {
          restBaseUrl: toolCalRestBase || undefined,
          authHeader: toolCalAuthHeader || undefined,
        },
      })
      setIntegrations(res.data.secretsMasked)
      setToolCalRestBase(res.data.secretsMasked.toolCalendar?.restBaseUrl ?? "")
      setToolCalAuthHeader("")
      toast.success("Calendario (REST) guardado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar calendario para tools")
    } finally {
      setIntBusy(false)
    }
  }

  const runTestOpenAi = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const r = await api.post<{ ok: boolean; message: string }>(
        "/settings/workspace/integrations/test-openai",
        {},
      )
      if (r.data.ok) toast.success(r.data.message)
      else toast.error(r.data.message)
    } catch (err) {
      toastIntegrationRequestError(err, "Falha no teste OpenAI")
    } finally {
      setIntBusy(false)
    }
  }

  const runTestSmtp = async () => {
    const api = integrationApi()
    if (!api || !smtpTestTo.trim()) return
    setIntBusy(true)
    try {
      const r = await api.post<{ ok: boolean; message: string }>(
        "/settings/workspace/integrations/test-smtp",
        { to: smtpTestTo.trim() },
      )
      if (r.data.ok) toast.success(r.data.message)
      else toast.error(r.data.message)
    } catch (err) {
      toastIntegrationRequestError(err, "Falha no teste SMTP")
    } finally {
      setIntBusy(false)
    }
  }

  const handleCopyApiKey = () => {
    if (!latestPlainApiKey) return
    navigator.clipboard.writeText(latestPlainApiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Chave API copiada!")
  }

  const handleCreateApiKey = async () => {
    if (!token || !currentWorkspace || !newApiKeyName.trim()) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setApiKeyBusy(true)
    try {
      const res = await api.post<{ id: string; name: string; key: string; createdAt?: string }>("/settings/api-keys", {
        name: newApiKeyName.trim(),
      })
      setLatestPlainApiKey(res.data.key)
      setApiKeys((prev) => [
        {
          id: res.data.id,
          name: res.data.name,
          prefix: `${res.data.key.slice(0, 22)}…`,
          createdAt: res.data.createdAt,
        },
        ...prev,
      ])
      setNewApiKeyName("")
      toast.success("Nova chave de API criada")
    } catch (err) {
      toastApiRequestError(err, "Falha ao criar chave de API")
    } finally {
      setApiKeyBusy(false)
    }
  }

  const handleRegenerateApiKey = async (id: string) => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setApiKeyBusy(true)
    try {
      const res = await api.post<{ id: string; name: string; key: string }>(`/settings/api-keys/${id}/regenerate`)
      setLatestPlainApiKey(res.data.key)
      setApiKeys((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                prefix: `${res.data.key.slice(0, 22)}…`,
              }
            : item,
        ),
      )
      toast.success("Nova chave API gerada!")
    } catch (err) {
      toastApiRequestError(err, "Falha ao regenerar chave de API")
    } finally {
      setApiKeyBusy(false)
    }
  }

  const handleDeleteApiKey = async (id: string) => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setApiKeyBusy(true)
    try {
      await api.del(`/settings/api-keys/${id}`)
      setApiKeys((prev) => prev.filter((item) => item.id !== id))
      toast.success("Chave de API removida")
    } catch (err) {
      toastApiRequestError(err, "Falha ao remover chave de API")
    } finally {
      setApiKeyBusy(false)
    }
  }

  const planBadgeVariant = {
    free: "secondary",
    pro: "default",
    enterprise: "default",
  } as const

  const planLabels = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-muted-foreground">
          Gerencie as configuracoes do workspace, perfil e preferencias.
        </p>
      </div>

      {/* Tabs */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid h-auto gap-1">
          <TabsTrigger value="workspace" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Workspace</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Integracoes</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificacoes</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Seguranca</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Faturamento</span>
          </TabsTrigger>
        </TabsList>

        {/* Workspace Settings */}
        <TabsContent value="workspace" className="space-y-6">
          <WorkspaceTeamSection />

          <Card>
            <CardHeader>
              <CardTitle>Informacoes do Workspace</CardTitle>
              <CardDescription>
                Configure as informacoes basicas do seu workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!currentWorkspace ? (
                <p className="text-sm text-muted-foreground">
                  Crie ou selecione um workspace para editar os detalhes.
                </p>
              ) : !workspace ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : null}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={workspace?.logo?.trim() || WORKSPACE_DEFAULT_LOGO}
                  />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {(workspace?.name ?? "WS").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    className="sr-only"
                    onChange={handleWorkspaceLogoFile}
                    aria-hidden
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!currentWorkspace || !workspace || logoUploading}
                    onClick={() => logoFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {logoUploading ? "Enviando..." : "Alterar Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG ou SVG. Maximo 2MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Nome do Workspace</Label>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-slug">Slug</Label>
                  <Input
                    id="workspace-slug"
                      value={(workspaceName || workspace?.name || "").toLowerCase().replace(/\s/g, "-")}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plano Atual</Label>
                <div className="flex items-center gap-3">
                  <Badge variant={planBadgeVariant[(workspace?.plan ?? "free") as keyof typeof planBadgeVariant]}>
                    {planLabels[(workspace?.plan ?? "free") as keyof typeof planLabels]}
                  </Badge>
                  {workspace?.plan !== "enterprise" && (
                    <Button variant="link" className="h-auto p-0 text-primary">
                      Fazer upgrade
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chaves de API</CardTitle>
              <CardDescription>
                Gerencie suas chaves de API para integracao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome da chave (ex: Integracao CRM)"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                />
                <Button onClick={handleCreateApiKey} disabled={apiKeyBusy || !newApiKeyName.trim()}>
                  Criar
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={latestPlainApiKey ?? "A chave completa aparece aqui ao criar/regenerar"}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyApiKey} disabled={!latestPlainApiKey}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A chave completa so e exibida no momento da criacao/regeneracao. Copie e armazene em local seguro.
              </p>
              <Separator />
              <div className="space-y-2">
                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma chave cadastrada.</p>
                ) : (
                  apiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{apiKey.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{apiKey.prefix}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleRegenerateApiKey(apiKey.id)}
                          disabled={apiKeyBusy}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                          disabled={apiKeyBusy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Alert>
            <Plug className="h-4 w-4" />
            <AlertTitle>Integracoes do workspace</AlertTitle>
            <AlertDescription>
              Chaves ficam cifradas no servidor. E necessario{" "}
              <code className="text-xs bg-muted px-1 rounded">ENCRYPTION_MASTER_KEY</code> no BFF. Apenas{" "}
              <strong>admin</strong> ou <strong>owner</strong> podem guardar alteracoes.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>AI Builder e team plans</CardTitle>
              <CardDescription>
                Controle como o workspace trata o bind automatico de `requiredPacks` e `requiredTools` sugeridos
                pelo planner.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={teamPlanPolicy?.autoBindEnabled ? "default" : "secondary"}>
                  {teamPlanPolicy?.autoBindEnabled ? "Auto-bind efetivo: ligado" : "Auto-bind efetivo: desligado"}
                </Badge>
                <Badge variant="outline">
                  origem:{" "}
                  {teamPlanPolicy?.source === "workspace_enabled"
                    ? "workspace ligado"
                    : teamPlanPolicy?.source === "workspace_disabled"
                      ? "workspace desligado"
                      : "padrao do servidor"}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-plan-auto-bind-mode">Politica do workspace</Label>
                <Select
                  value={teamPlanAutoBindMode}
                  onValueChange={(value) =>
                    setTeamPlanAutoBindMode(value as "inherit" | "enabled" | "disabled")
                  }
                >
                  <SelectTrigger id="team-plan-auto-bind-mode" className="w-[min(100%,320px)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Herdar padrao do servidor</SelectItem>
                    <SelectItem value="enabled">Forcar ligado neste workspace</SelectItem>
                    <SelectItem value="disabled">Forcar desligado neste workspace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Isto controla apenas o bind automatico durante `team-plans/:id/execute`. Mesmo ligado, agentes
                reutilizados seguem a politica escolhida abaixo.
              </p>
              <div className="space-y-2">
                <Label htmlFor="team-plan-reused-mode">Agentes reutilizados (`existing`)</Label>
                <Select
                  value={reusedAgentBindMode}
                  onValueChange={(value) => setReusedAgentBindMode(value as "manual" | "merge")}
                >
                  <SelectTrigger id="team-plan-reused-mode" className="w-[min(100%,320px)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual: nao fazer bind automatico</SelectItem>
                    <SelectItem value="merge">Merge: adicionar tools sugeridas ao agente reutilizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Modo atual para `reused`:{" "}
                <strong>
                  {teamPlanPolicy?.reusedAgentBindMode === "merge"
                    ? "merge controlado"
                    : "habilitacao manual"}
                </strong>
                .
              </p>
              <Button onClick={() => void saveTeamPlanPolicy()} disabled={intBusy}>
                Guardar politica de auto-bind
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI (BYOK)</CardTitle>
              <CardDescription>
                Chave para o runtime dos agentes neste workspace e para a ferramenta de catalogo{" "}
                <code className="text-xs">image_generation</code> (DALL-E 2 / DALL-E 3), quando ativa no agente.{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1"
                >
                  Obter chave <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {integrations?.openaiApiKeyConfigured ? (
                <p className="text-sm text-muted-foreground">
                  Configurado:{" "}
                  <span className="font-mono">{integrations.openaiApiKeyMasked ?? "****"}</span>
                </p>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Nenhuma chave neste workspace. O servidor pode ainda usar{" "}
                  <code className="text-xs">OPENAI_API_KEY</code> apenas em demo local.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="openai-key">Nova chave (substitui a anterior)</Label>
                <Input
                  id="openai-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-..."
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void saveOpenAiIntegration()}
                  disabled={intBusy || !openaiKeyInput.trim()}
                >
                  Guardar OpenAI
                </Button>
                <Button variant="outline" onClick={() => void clearOpenAiIntegration()} disabled={intBusy}>
                  Limpar chave
                </Button>
                <Button variant="secondary" onClick={() => void runTestOpenAi()} disabled={intBusy}>
                  Testar ligacao
                </Button>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="image-gen-model">Modelo padrao para geracao de imagens (catalog)</Label>
                <p className="text-xs text-muted-foreground">
                  Usado quando a tool envia <code className="text-xs">model: default</code>. DALL-E 2 costuma ser mais
                  barato; DALL-E 3 tende a melhor qualidade. Sem preferencia guardada, o runtime usa DALL-E 3 ao
                  resolver <code className="text-xs">default</code>.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    value={imageGenModelDefault}
                    onValueChange={(v) =>
                      setImageGenModelDefault(v as "__default__" | "dall-e-2" | "dall-e-3")
                    }
                  >
                    <SelectTrigger id="image-gen-model" className="w-[min(100%,280px)]">
                      <SelectValue placeholder="Escolher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Sem preferencia (padrao runtime: DALL-E 3)</SelectItem>
                      <SelectItem value="dall-e-2">DALL-E 2 (custo menor)</SelectItem>
                      <SelectItem value="dall-e-3">DALL-E 3 (qualidade)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void saveImageGenerationModelDefault()}
                    disabled={intBusy}
                  >
                    Guardar modelo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMTP (e-mail)</CardTitle>
              <CardDescription>Envio de e-mails a partir deste workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp..." />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                  <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} id="smtp-sec" />
                  <Label htmlFor="smtp-sec">TLS/SSL (secure)</Label>
                </div>
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={integrations?.smtp?.passwordConfigured ? "(deixe vazio para manter)" : ""}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>From (opcional)</Label>
                  <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <Button onClick={() => void saveSmtpIntegration()} disabled={intBusy}>
                  Guardar SMTP
                </Button>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-xs">Testar envio para</Label>
                  <Input value={smtpTestTo} onChange={(e) => setSmtpTestTo(e.target.value)} type="email" />
                </div>
                <Button variant="secondary" onClick={() => void runTestSmtp()} disabled={intBusy}>
                  Enviar teste
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slack (workspace)</CardTitle>
              <CardDescription>
                Fallback quando o canal nao tem segredos proprios. Canais Chat SDK podem sobrepor com{" "}
                <strong>Configurar</strong> na lista de canais.{" "}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1"
                >
                  Slack API <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Signing secret</Label>
                  <Input
                    type="password"
                    value={slackSigning}
                    onChange={(e) => setSlackSigning(e.target.value)}
                    placeholder={integrations?.slack?.signingSecretMasked ? "(configurado)" : ""}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bot token</Label>
                  <Input
                    type="password"
                    value={slackBot}
                    onChange={(e) => setSlackBot(e.target.value)}
                    placeholder={integrations?.slack?.botTokenMasked ? "(configurado)" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client ID (opcional)</Label>
                  <Input value={slackClientId} onChange={(e) => setSlackClientId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Client secret (opcional)</Label>
                  <Input
                    type="password"
                    value={slackClientSecret}
                    onChange={(e) => setSlackClientSecret(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={() => void saveSlackIntegration()} disabled={intBusy}>
                Guardar Slack
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Tools do catalogo — Postgres (database_query)
              </CardTitle>
              <CardDescription>
                Connection string <strong>somente leitura</strong> para a tool <code className="text-xs">database_query</code>.
                Deixe vazio e guarde para remover. A URL nunca e exibida de volta; apenas se ha credencial configurada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Estado:{" "}
                {integrations?.toolDatabase?.postgresReadOnlyUrlConfigured ? (
                  <Badge variant="secondary">Configurado</Badge>
                ) : (
                  <span className="text-amber-600 dark:text-amber-500">Nao configurado</span>
                )}
              </p>
              <div className="space-y-2">
                <Label htmlFor="tool-pg-url">Nova connection string (postgres://...)</Label>
                <Input
                  id="tool-pg-url"
                  type="password"
                  autoComplete="off"
                  value={toolDbPostgresUrl}
                  onChange={(e) => setToolDbPostgresUrl(e.target.value)}
                  placeholder={integrations?.toolDatabase?.postgresReadOnlyUrlConfigured ? "(substituir ou limpar)" : ""}
                />
              </div>
              <Button onClick={() => void saveToolDatabaseIntegration()} disabled={intBusy}>
                Guardar Postgres
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Tools do catalogo — CRM (crm_access)
              </CardTitle>
              <CardDescription>
                API REST base (ex. <code className="text-xs">https://crm.exemplo.com/api</code>). O backend chama{" "}
                <code className="text-xs">GET ...?q=...</code> com Bearer se configurado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>REST base URL</Label>
                  <Input
                    value={toolCrmRestBase}
                    onChange={(e) => setToolCrmRestBase(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bearer token</Label>
                  <Input
                    type="password"
                    value={toolCrmBearer}
                    onChange={(e) => setToolCrmBearer(e.target.value)}
                    placeholder={
                      integrations?.toolCrm?.bearerTokenConfigured ? "(deixe vazio para manter)" : ""
                    }
                  />
                </div>
              </div>
              <Button onClick={() => void saveToolCrmIntegration()} disabled={intBusy}>
                Guardar CRM
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Tools do catalogo — Calendario (calendar_access)
              </CardTitle>
              <CardDescription>
                Base URL para pedidos HTTP relativos da tool. Envie o header <code className="text-xs">Authorization</code>{" "}
                completo se o destino exigir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>REST base URL</Label>
                  <Input
                    value={toolCalRestBase}
                    onChange={(e) => setToolCalRestBase(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Authorization (header completo)</Label>
                  <Input
                    type="password"
                    value={toolCalAuthHeader}
                    onChange={(e) => setToolCalAuthHeader(e.target.value)}
                    placeholder={
                      integrations?.toolCalendar?.authHeaderConfigured ? "(deixe vazio para manter)" : ""
                    }
                  />
                </div>
              </div>
              <Button onClick={() => void saveToolCalendarIntegration()} disabled={intBusy}>
                Guardar calendario
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacoes Pessoais</CardTitle>
              <CardDescription>
                Atualize suas informacoes de perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar} className="object-cover" />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {(profile?.name ?? userName ?? "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="sr-only"
                    onChange={handleProfileAvatarFile}
                    aria-hidden
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarFileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar Foto
                    </Button>
                    {profile?.avatar ? (
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveProfileAvatar}>
                        Remover foto
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG. Maximo 1MB. A foto e guardada no servidor (data URL).
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-name">Nome Completo</Label>
                  <Input
                    id="user-name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input id="user-email" type="email" value={userEmail} readOnly className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">
                    O email de login nao pode ser alterado aqui.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-bio">Bio</Label>
                <Textarea
                  id="user-bio"
                  placeholder="Conte um pouco sobre voce..."
                  rows={3}
                  value={userBio}
                  onChange={(e) => setUserBio(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferencias</CardTitle>
              <CardDescription>
                Configure suas preferencias de uso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Idioma</p>
                    <p className="text-sm text-muted-foreground">
                      Selecione o idioma da interface
                    </p>
                  </div>
                </div>
                <Select
                  value={prefLocale}
                  onValueChange={(v) => setPrefLocale(v as IUserPreferences["locale"])}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Portugues (BR)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es">Espanol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Tema</p>
                    <p className="text-sm text-muted-foreground">
                      Escolha o tema da aplicacao
                    </p>
                  </div>
                </div>
                <Select
                  value={prefTheme}
                  onValueChange={(v) => setPrefTheme(v as IUserPreferences["theme"])}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Escuro</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Canais de Notificacao</CardTitle>
              <CardDescription>
                Escolha como deseja receber notificacoes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    Receba notificacoes por email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Slack</p>
                  <p className="text-sm text-muted-foreground">
                    Receba notificacoes no Slack
                  </p>
                </div>
                <Switch
                  checked={slackNotifications}
                  onCheckedChange={setSlackNotifications}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de Notificacao</CardTitle>
              <CardDescription>
                Selecione quais notificacoes deseja receber.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alertas de Sistema</p>
                  <p className="text-sm text-muted-foreground">
                    Erros, falhas e problemas criticos
                  </p>
                </div>
                <Switch
                  checked={alertsEnabled}
                  onCheckedChange={setAlertsEnabled}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Relatorio Semanal</p>
                  <p className="text-sm text-muted-foreground">
                    Resumo de performance dos times
                  </p>
                </div>
                <Switch
                  checked={weeklyReport}
                  onCheckedChange={setWeeklyReport}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Autenticacao</CardTitle>
              <CardDescription>
                Gerencie suas opcoes de seguranca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Alterar Senha</p>
                    <p className="text-sm text-muted-foreground">
                      Ultima alteracao ha 3 meses
                    </p>
                  </div>
                </div>
                <Button variant="outline">Alterar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Autenticacao em Dois Fatores</p>
                    <p className="text-sm text-muted-foreground">
                      Adicione uma camada extra de seguranca
                    </p>
                  </div>
                </div>
                <Button variant="outline">Configurar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessoes Ativas</CardTitle>
              <CardDescription>
                Gerencie suas sessoes em diferentes dispositivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="font-medium">Chrome - macOS</p>
                  <p className="text-sm text-muted-foreground">
                    Sao Paulo, Brasil - Sessao atual
                  </p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500/50">
                  Ativa
                </Badge>
              </div>
              <Button variant="outline" className="w-full text-destructive">
                Encerrar Todas as Outras Sessoes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
              <CardDescription>
                Acoes irreversiveis. Tenha cuidado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Voce tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acao nao pode ser desfeita. Todos os seus dados, times,
                      agentes e configuracoes serao permanentemente excluidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir Conta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>
                Gerencie sua assinatura e faturamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-primary/5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{planLabels[currentPlan]}</h3>
                    <Badge variant={planBadgeVariant[currentPlan]}>
                      {currentPlan === "enterprise" ? "Personalizado" : "Ativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentPlan === "free" && "Ate 2 times e 5 agentes"}
                    {currentPlan === "pro" && "Ate 10 times e 50 agentes"}
                    {currentPlan === "enterprise" && "Times e agentes ilimitados"}
                  </p>
                </div>
                {currentPlan !== "enterprise" && (
                  <Button>Fazer Upgrade</Button>
                )}
              </div>

              {currentPlan !== "free" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium">Metodo de Pagamento</h4>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-12 bg-muted rounded flex items-center justify-center text-xs font-bold">
                          VISA
                        </div>
                        <div>
                          <p className="font-medium">**** **** **** 4242</p>
                          <p className="text-sm text-muted-foreground">Expira 12/2025</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Alterar</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {currentPlan !== "free" && (
            <Card>
              <CardHeader>
                <CardTitle>Historico de Faturas</CardTitle>
                <CardDescription>
                  Visualize e baixe suas faturas anteriores.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { date: "01/03/2024", amount: "R$ 199,00", status: "Pago" },
                    { date: "01/02/2024", amount: "R$ 199,00", status: "Pago" },
                    { date: "01/01/2024", amount: "R$ 199,00", status: "Pago" },
                  ].map((invoice, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{invoice.date}</p>
                        <p className="text-sm text-muted-foreground">{invoice.amount}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-500 border-green-500/50">
                          {invoice.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          Baixar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </Button>
      </div>
    </div>
  )
}
