"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkspaceTeamSection } from "@/components/workspace/workspace-team-section"
import type { IPlatformDangerZoneStatus, IUserNotificationPreferences, IUserPreferences } from "@/lib/types"

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

function defaultNotificationPrefs(): IUserNotificationPreferences {
  return {
    email: true,
    slack: false,
    discord: false,
    alertsEnabled: true,
    weeklyReport: true,
  }
}

function parseNotificationPrefs(prefs: Record<string, unknown> | undefined): IUserNotificationPreferences {
  const raw = prefs?.notifications
  const n = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const d = defaultNotificationPrefs()
  return {
    email: typeof n.email === "boolean" ? n.email : d.email,
    slack: typeof n.slack === "boolean" ? n.slack : d.slack,
    discord: typeof n.discord === "boolean" ? n.discord : d.discord,
    alertsEnabled: typeof n.alertsEnabled === "boolean" ? n.alertsEnabled : d.alertsEnabled,
    weeklyReport: typeof n.weeklyReport === "boolean" ? n.weeklyReport : d.weeklyReport,
  }
}

type WorkspaceLimits = {
  maxTeams: number
  maxAgents: number
  maxChannels: number
  usedTeams: number
  usedAgents: number
  usedChannels: number
}

type SettingsWorkspaceState = {
  id: string
  name: string
  logo?: string
  plan?: string
  settings?: Record<string, unknown>
  limits?: WorkspaceLimits
}

function formatQuotaPair(used: number, max: number): string {
  if (max === -1) return `${used} / ilimitado`
  return `${used} / ${max}`
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, refreshToken, currentWorkspace, bootstrap, refreshSessionUser, logout, user } =
    useWorkspaceStore()
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

  const [notificationPrefs, setNotificationPrefs] = useState<IUserNotificationPreferences>(() =>
    defaultNotificationPrefs(),
  )
  const [notifSaving, setNotifSaving] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [pwdBusy, setPwdBusy] = useState(false)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [dangerZoneStatus, setDangerZoneStatus] = useState<IPlatformDangerZoneStatus | null>(null)
  const [dangerZoneLoading, setDangerZoneLoading] = useState(false)
  const [factoryResetPhrase, setFactoryResetPhrase] = useState("")
  const [factoryResetEmail, setFactoryResetEmail] = useState("")
  const [factoryProdPhrase, setFactoryProdPhrase] = useState("")
  const [factoryAckIrreversible, setFactoryAckIrreversible] = useState(false)
  const [factoryBusy, setFactoryBusy] = useState(false)
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
      setNotificationPrefs(parseNotificationPrefs(prefs as Record<string, unknown>))
    })()
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (defaultTab === "security" && token) {
      void refreshSessionUser()
    }
  }, [defaultTab, token, refreshSessionUser])

  useEffect(() => {
    if (!token || user?.isPlatformAdmin !== true) {
      setDangerZoneStatus(null)
      return
    }
    setDangerZoneLoading(true)
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => null,
    })
    void (async () => {
      try {
        const res = await api.get<IPlatformDangerZoneStatus>("/platform/danger-zone/status", {
          tenant: false,
        })
        setDangerZoneStatus(res.data)
        setFactoryResetEmail(user.email ?? "")
      } catch {
        setDangerZoneStatus(null)
      } finally {
        setDangerZoneLoading(false)
      }
    })()
  }, [token, refreshToken, user?.isPlatformAdmin, user?.email])

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
          notifications: { ...notificationPrefs },
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

  const saveNotificationsOnly = async () => {
    if (!token) return
    setNotifSaving(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace?.id,
      })
      const res = await api.put<ProfileApiResponse & { message: string }>(
        "/settings/profile",
        { preferences: { notifications: { ...notificationPrefs } } },
        { tenant: false },
      )
      const p = res.data
      setProfile({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar: p.avatar,
        preferences: p.preferences ?? {},
      })
      setNotificationPrefs(parseNotificationPrefs(p.preferences as Record<string, unknown>))
      await refreshSessionUser()
      toast.success("Preferencias de notificacao guardadas")
    } catch (err) {
      toastApiRequestError(err, "Falha ao guardar notificacoes")
    } finally {
      setNotifSaving(false)
    }
  }

  const submitChangePassword = async () => {
    if (!token) return
    if (newPwd.length < 8) {
      toast.error("Nova senha: minimo 8 caracteres.")
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error("A confirmacao nao coincide com a nova senha.")
      return
    }
    setPwdBusy(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace?.id,
      })
      await api.post(
        "/auth/change-password",
        { currentPassword: currentPwd, newPassword: newPwd },
        { tenant: false },
      )
      toast.success("Senha atualizada. O token de renovacao foi invalidado; outros dispositivos precisam de novo login.")
      setPasswordDialogOpen(false)
      setCurrentPwd("")
      setNewPwd("")
      setConfirmPwd("")
      await refreshSessionUser()
    } catch (err) {
      toastApiRequestError(err, "Nao foi possivel alterar a senha")
    } finally {
      setPwdBusy(false)
    }
  }

  const revokeAllSessions = async () => {
    if (!token) return
    setRevokeBusy(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace?.id,
      })
      await api.post("/auth/revoke-sessions", {}, { tenant: false })
      toast.success("Renovacao invalidada. A iniciar sessao novamente...")
      await logout()
      router.push("/login")
    } catch (err) {
      toastApiRequestError(err, "Falha ao invalidar sessoes")
    } finally {
      setRevokeBusy(false)
    }
  }

  const submitFactoryReset = async () => {
    if (!token || !dangerZoneStatus?.factoryResetAvailable) return
    setFactoryBusy(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => null,
      })
      const body: {
        confirmPhrase: "RESET_FACTORY_INSTALLATION"
        confirmEmail: string
        acknowledgeIrreversible: true
        productionSafetyPhrase?: "DELETE_ALL_PRODUCTION_DATA"
      } = {
        confirmPhrase: "RESET_FACTORY_INSTALLATION",
        confirmEmail: factoryResetEmail.trim(),
        acknowledgeIrreversible: true,
      }
      if (dangerZoneStatus.requiresProductionSafetyPhrase) {
        body.productionSafetyPhrase = "DELETE_ALL_PRODUCTION_DATA"
      }
      await api.post("/platform/danger-zone/factory-reset", body, { tenant: false })
      toast.success("Base apagada. Execute o seed no servidor se precisar de dados de demonstracao.")
      await logout()
      router.push("/login")
    } catch (err) {
      toastApiRequestError(err, "Reset de fabrica falhou")
    } finally {
      setFactoryBusy(false)
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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configuracoes</h1>
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
                Tokens para a API HTTP desta plataforma (autenticacao de integracoes e automacoes).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-primary/20 bg-muted/20">
                <Key className="h-4 w-4" />
                <AlertTitle>O que e isto</AlertTitle>
                <AlertDescription className="space-y-2 text-sm">
                  <p>
                    Cada chave autoriza pedidos <code className="text-xs">Bearer</code> a{" "}
                    <code className="text-xs">/api/v1/...</code> com o cabecalho{" "}
                    <code className="text-xs">X-Workspace-Id</code> deste workspace. Use em scripts, gateways ou
                    servicos externos que precisem de criar runs, ler agentes, etc.
                  </p>
                  <p className="text-muted-foreground">
                    Nao e a chave OpenAI (essa esta em Integracoes) nem segredos de Slack/Discord dos canais.
                  </p>
                </AlertDescription>
              </Alert>
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

          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Leitura rapida</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                <strong className="text-foreground">OpenAI (BYOK)</strong>: alimenta o runtime dos agentes e tools de
                catalogo (ex. <code className="text-xs">image_generation</code>). Use &quot;Testar ligacao&quot; para
                validar antes de colocar em producao.
              </p>
              <p>
                <strong className="text-foreground">SMTP / Slack (workspace)</strong>: base para envio de email e
                fallback Slack; conversas em tempo real passam por{" "}
                <Link href="/channels" className="text-primary underline-offset-4 hover:underline">
                  Canais
                </Link>{" "}
                (Chat SDK ou genericos).
              </p>
              <p>
                <strong className="text-foreground">Tools do catalogo</strong>: ligue Postgres (somente leitura) para{" "}
                <code className="text-xs">database_query</code> e/ou calendario REST para{" "}
                <code className="text-xs">calendar_access</code>. CRM persistido no produto e via pack de negocio (
                <code className="text-xs">internal_action</code> / <code className="text-xs">crm_*</code>), nao por URL
                generica aqui.
              </p>
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
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>Preferencias guardadas na sua conta</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Estas opcoes ficam em <code className="text-xs bg-muted px-1 rounded">user.preferences.notifications</code>{" "}
                e serao usadas quando o produto enviar alertas (email, Slack ou Discord). Configure SMTP e segredos do
                workspace em{" "}
                <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                  Integracoes
                </Link>
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Pode guardar so esta aba com o botao abaixo ou usar &quot;Salvar Alteracoes&quot; no fim da pagina (inclui
                workspace e perfil).
              </p>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Canais de notificacao</CardTitle>
              <CardDescription>
                Onde pretende receber avisos operacionais (quando o backend tiver entrega ligada a estes canais).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    Requer{" "}
                    <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                      SMTP configurado
                    </Link>{" "}
                    no workspace para envio real.
                  </p>
                </div>
                <Switch
                  checked={Boolean(notificationPrefs.email)}
                  onCheckedChange={(v) =>
                    setNotificationPrefs((prev) => ({ ...prev, email: v }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Slack</p>
                  <p className="text-sm text-muted-foreground">
                    Usa o webhook ou app do workspace em{" "}
                    <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                      Integracoes
                    </Link>
                    ; canais de conversa em{" "}
                    <Link href="/channels" className="text-primary underline-offset-4 hover:underline">
                      Canais
                    </Link>{" "}
                    (Chat SDK) sao outro fluxo.
                  </p>
                </div>
                <Switch
                  checked={Boolean(notificationPrefs.slack)}
                  onCheckedChange={(v) =>
                    setNotificationPrefs((prev) => ({ ...prev, slack: v }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Discord</p>
                  <p className="text-sm text-muted-foreground">
                    Preferencia para alertas via bot Discord; crie um canal{" "}
                    <strong>Chat SDK — Discord</strong> em{" "}
                    <Link href="/channels" className="text-primary underline-offset-4 hover:underline">
                      Canais
                    </Link>{" "}
                    e configure segredos em Configurar.
                  </p>
                </div>
                <Switch
                  checked={Boolean(notificationPrefs.discord)}
                  onCheckedChange={(v) =>
                    setNotificationPrefs((prev) => ({ ...prev, discord: v }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de notificacao</CardTitle>
              <CardDescription>
                Quais categorias de aviso deseja receber (quando disponiveis no produto).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Alertas de sistema</p>
                  <p className="text-sm text-muted-foreground">
                    Erros, falhas e incidentes criticos.
                  </p>
                </div>
                <Switch
                  checked={Boolean(notificationPrefs.alertsEnabled)}
                  onCheckedChange={(v) =>
                    setNotificationPrefs((prev) => ({ ...prev, alertsEnabled: v }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Relatorio semanal</p>
                  <p className="text-sm text-muted-foreground">
                    Resumo de utilizacao e metricas dos times (quando existir job de envio).
                  </p>
                </div>
                <Switch
                  checked={Boolean(notificationPrefs.weeklyReport)}
                  onCheckedChange={(v) =>
                    setNotificationPrefs((prev) => ({ ...prev, weeklyReport: v }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveNotificationsOnly()} disabled={notifSaving}>
              {notifSaving ? "A guardar..." : "Guardar notificacoes"}
            </Button>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Autenticacao</CardTitle>
              <CardDescription>
                Palavra-passe e protecoes da conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Alterar senha</p>
                    <p className="text-sm text-muted-foreground">
                      Apos alterar, o token de renovacao e invalidado (outros dispositivos perdem a sessao de longa duracao).
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                  Alterar
                </Button>
              </div>
              <Separator />
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Autenticacao em dois fatores (2FA)</AlertTitle>
                <AlertDescription>
                  Ainda nao esta disponivel nesta versao do produto. Quando existir backend TOTP/WebAuthn, esta secao
                  passara a permitir configuracao.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessao e renovacao de tokens</CardTitle>
              <CardDescription>
                O servidor guarda um refresh token por conta (renovacao da sessao). Nao ha lista multi-dispositivo
                neste MVP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="font-medium">Renovacao de sessao</p>
                  <p className="text-sm text-muted-foreground">
                    Estado no servidor apos o ultimo login ou renovacao bem-sucedida.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    user?.session?.hasRefreshToken
                      ? "text-green-600 border-green-600/50"
                      : "text-muted-foreground"
                  }
                >
                  {user?.session?.hasRefreshToken ? "Ativa" : "Sem refresh"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Para sair apenas neste browser, use <strong>Sair</strong> no menu. Para forcar novo login em todos os
                sitios que guardaram a renovacao, use o botao abaixo (termina a sessao atual tambem).
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
                disabled={revokeBusy}
                onClick={() => void revokeAllSessions()}
              >
                {revokeBusy ? "A invalidar..." : "Invalidar renovacao em todos os dispositivos"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Conta</CardTitle>
              <CardDescription>Exclusao automatica de conta nao esta disponivel.</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                <Trash2 className="h-4 w-4" />
                <AlertTitle>Exclusao de conta</AlertTitle>
                <AlertDescription>
                  Nao existe endpoint de apagar conta nesta versao. Para pedidos de encerramento, contacte o
                  administrador da sua organizacao ou suporte da plataforma.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {user?.isPlatformAdmin === true && (
            <Card className="border-destructive/60">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Zona de perigo (plataforma)
                </CardTitle>
                <CardDescription>
                  Apenas administrador global. Apaga <strong>todos</strong> os documentos MongoDB da aplicacao
                  (utilizadores, workspaces, agentes, auditoria, etc.). O servidor deve ter{" "}
                  <span className="font-mono text-xs">DANGER_ZONE_FACTORY_RESET_ENABLED=1</span>; em producao e
                  necessario tambem <span className="font-mono text-xs">DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION=1</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dangerZoneLoading ? (
                  <p className="text-sm text-muted-foreground">A carregar estado...</p>
                ) : !dangerZoneStatus ? (
                  <Alert>
                    <AlertTitle>Indisponivel</AlertTitle>
                    <AlertDescription>Nao foi possivel obter o estado da zona de perigo.</AlertDescription>
                  </Alert>
                ) : !dangerZoneStatus.factoryResetAvailable ? (
                  <Alert variant="destructive">
                    <AlertTitle>Reset desactivado</AlertTitle>
                    <AlertDescription>
                      {dangerZoneStatus.blockedReason ??
                        "Configure as variaveis de ambiente no BFF para activar com seguranca."}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                      <AlertTitle>Irreversivel</AlertTitle>
                      <AlertDescription>
                        Apos o pedido bem-sucedido a sessao actual deixa de corresponder a dados na base; sera
                        redireccionado para o login. Volte a executar o seed no servidor se precisar de dados de
                        demonstracao.
                      </AlertDescription>
                    </Alert>
                    {dangerZoneStatus.requiresProductionSafetyPhrase ? (
                      <div className="space-y-2 max-w-md">
                        <Label htmlFor="factory-prod-phrase">Confirmacao extra (producao)</Label>
                        <Input
                          id="factory-prod-phrase"
                          value={factoryProdPhrase}
                          onChange={(e) => setFactoryProdPhrase(e.target.value)}
                          placeholder="DELETE_ALL_PRODUCTION_DATA"
                          autoComplete="off"
                          disabled={factoryBusy}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Escreva exactamente DELETE_ALL_PRODUCTION_DATA para confirmar perda total em producao.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="factory-phrase">Frase de confirmacao</Label>
                      <Input
                        id="factory-phrase"
                        value={factoryResetPhrase}
                        onChange={(e) => setFactoryResetPhrase(e.target.value)}
                        placeholder="RESET_FACTORY_INSTALLATION"
                        autoComplete="off"
                        disabled={factoryBusy}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="factory-email">Email da sessao</Label>
                      <Input
                        id="factory-email"
                        type="email"
                        value={factoryResetEmail}
                        onChange={(e) => setFactoryResetEmail(e.target.value)}
                        autoComplete="off"
                        disabled={factoryBusy}
                      />
                      <p className="text-xs text-muted-foreground">Deve coincidir com o email com que iniciou sessao.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="factory-ack"
                        checked={factoryAckIrreversible}
                        onCheckedChange={(v) => setFactoryAckIrreversible(v === true)}
                        disabled={factoryBusy}
                      />
                      <Label htmlFor="factory-ack" className="text-sm font-normal leading-snug cursor-pointer">
                        Compreendo que esta operacao apaga permanentemente todos os dados da instalacao.
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        factoryBusy ||
                        factoryResetPhrase !== "RESET_FACTORY_INSTALLATION" ||
                        !factoryResetEmail.trim() ||
                        !factoryAckIrreversible ||
                        (dangerZoneStatus.requiresProductionSafetyPhrase &&
                          factoryProdPhrase !== "DELETE_ALL_PRODUCTION_DATA")
                      }
                      onClick={() => void submitFactoryReset()}
                    >
                      {factoryBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          A apagar...
                        </>
                      ) : (
                        "Apagar toda a base (factory reset)"
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>
                Limites efectivos do workspace (API). Checkout e faturas ainda nao estao integrados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-primary/5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{planLabels[currentPlan]}</h3>
                    <Badge variant={planBadgeVariant[currentPlan]}>
                      {currentPlan === "enterprise" ? "Personalizado" : "Ativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {workspace?.limits ? (
                      <>
                        Times {formatQuotaPair(workspace.limits.usedTeams, workspace.limits.maxTeams)} · Agentes{" "}
                        {formatQuotaPair(workspace.limits.usedAgents, workspace.limits.maxAgents)} · Canais{" "}
                        {formatQuotaPair(workspace.limits.usedChannels, workspace.limits.maxChannels)}
                      </>
                    ) : (
                      "Carregando consumo..."
                    )}
                  </p>
                </div>
                {currentPlan !== "enterprise" && (
                  <Button type="button" onClick={() => setUpgradeDialogOpen(true)}>
                    Fazer upgrade
                  </Button>
                )}
              </div>

              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertTitle>Pagamentos e historico de faturas</AlertTitle>
                <AlertDescription>
                  Nao ha gateway de pagamento ligado nesta versao. Os limites acima reflectem a regra do plano no
                  servidor; nao e possivel alterar o plano pela UI ate haver integracao de billing.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upgrade de plano</DialogTitle>
                <DialogDescription>
                  O checkout (cartao, Stripe, etc.) ainda nao esta disponivel. Para Pro ou Enterprise, contacte a
                  equipa de produto ou suporte com o ID do workspace.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Workspace: <span className="font-mono text-foreground">{workspace?.id ?? "—"}</span>
              </p>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
                  Fechar
                </Button>
                <Button type="button" asChild>
                  <a href="mailto:suporte@whitebeard.dev?subject=Upgrade%20de%20plano%20agents-team-crafter">
                    Enviar email
                  </a>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </Button>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              Minimo 8 caracteres. A renovacao de sessao sera invalidada apos guardar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="pwd-current">Senha atual</Label>
              <Input
                id="pwd-current"
                type="password"
                autoComplete="current-password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-new">Nova senha</Label>
              <Input
                id="pwd-new"
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-confirm">Confirmar nova senha</Label>
              <Input
                id="pwd-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitChangePassword()} disabled={pwdBusy}>
              {pwdBusy ? "A guardar..." : "Guardar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
