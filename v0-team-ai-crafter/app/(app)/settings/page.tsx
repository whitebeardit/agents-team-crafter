"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkspaceTeamSection } from "@/components/workspace/workspace-team-section"
import { WorkspaceVaultCard } from "@/components/workspace/workspace-vault-card"
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

/** Alinhado ao enum do BFF (`EOpenAiWorkspaceChatModel`). */
const OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK: readonly string[] = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
]

type IntegrationsApiData = {
  availableOpenAiChatModels?: string[]
  allowedLlmModelIds?: string[]
  operationalCatalogTools?: Array<{ id: string; name: string; description: string }>
  secretsMasked: {
    llmProvider?: "openai" | "openrouter"
    openrouterApiKeyConfigured?: boolean
    openrouterApiKeyMasked?: string
    openrouterRuntimeModel?: string
    openrouterPlannerModel?: string
    allowedLlmModelIds?: string[]
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
    toolCalendar?: { restBaseUrl?: string; authHeaderConfigured: boolean }
    /** Padrao workspace para tool catalog_image_generation quando model=default */
    imageGenerationModel?: "dall-e-2" | "dall-e-3"
    enabledOpenAiChatModels?: string[]
    agentsRuntimeModel?: string
    teamPlannerModel?: string
  }
}

type TOpenRouterCatalogRow = {
  id: string
  name: string
  supportsTools?: boolean
  supportsStructuredOutputs?: boolean
  /** Ordem na resposta OpenRouter (`order=most-popular`); menor = mais popular no topo. */
  listingIndex?: number
  pricing?: {
    promptUsdPer1M: number | null
    completionUsdPer1M: number | null
    isFree: boolean
  }
}

/** Exibe preço em USD / 1M tokens (como no site OpenRouter). */
function formatOrUsdPer1m(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  if (value === 0) return "$0"
  if (value < 1e-6) return `$${value.toExponential(1)}`
  if (value < 0.01) return `$${value.toFixed(6)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(3)}`
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
  const {
    token,
    refreshToken,
    currentWorkspace,
    bootstrap,
    refreshSessionUser,
    logout,
    user,
    patchWorkspacePlan,
  } = useWorkspaceStore()
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
  const [availableChatModels, setAvailableChatModels] = useState<string[]>([])
  const [enabledChatModelsSelection, setEnabledChatModelsSelection] = useState<string[]>([])
  const [agentsRuntimeModelPick, setAgentsRuntimeModelPick] = useState<string>("__unset__")
  const [teamPlannerModelPick, setTeamPlannerModelPick] = useState<string>("__unset__")
  const [llmProviderPick, setLlmProviderPick] = useState<"openai" | "openrouter">("openrouter")
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState("")
  const [orCatalogModels, setOrCatalogModels] = useState<TOpenRouterCatalogRow[]>([])
  const [orCatalogLoading, setOrCatalogLoading] = useState(false)
  const [orCatalogQuery, setOrCatalogQuery] = useState("")
  const [orCatalogPriceMode, setOrCatalogPriceMode] = useState<"all" | "free" | "max">("all")
  const [orCatalogMaxUsdPer1mIn, setOrCatalogMaxUsdPer1mIn] = useState("")
  const [orCatalogSort, setOrCatalogSort] = useState<"popular" | "id" | "price_in_asc" | "price_in_desc">("popular")
  const [allowedOrModels, setAllowedOrModels] = useState<string[]>([])
  const [orRuntimePick, setOrRuntimePick] = useState<string>("__unset__")
  const [orPlannerPick, setOrPlannerPick] = useState<string>("__unset__")
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
  const [platformPlanDraft, setPlatformPlanDraft] = useState<"free" | "pro" | "enterprise">("free")
  const [platformPlanBusy, setPlatformPlanBusy] = useState(false)
  const [dangerZoneStatus, setDangerZoneStatus] = useState<IPlatformDangerZoneStatus | null>(null)
  const [dangerZoneLoading, setDangerZoneLoading] = useState(false)
  const [factoryResetPhrase, setFactoryResetPhrase] = useState("")
  const [factoryResetEmail, setFactoryResetEmail] = useState("")
  const [factoryProdPhrase, setFactoryProdPhrase] = useState("")
  const [factoryAckIrreversible, setFactoryAckIrreversible] = useState(false)
  const [factoryBusy, setFactoryBusy] = useState(false)
  const currentPlan = (workspace?.plan ?? "free") as "free" | "pro" | "enterprise"

  const applyIntegrationsChatState = useCallback((data: IntegrationsApiData) => {
    const prov = data.secretsMasked.llmProvider === "openai" ? "openai" : "openrouter"
    setLlmProviderPick(prov)
    const am =
      data.secretsMasked.allowedLlmModelIds?.length && data.secretsMasked.allowedLlmModelIds.length > 0
        ? [...data.secretsMasked.allowedLlmModelIds]
        : data.allowedLlmModelIds?.length
          ? [...data.allowedLlmModelIds]
          : []
    setAllowedOrModels(am)
    setOrRuntimePick(data.secretsMasked.openrouterRuntimeModel?.trim() ? data.secretsMasked.openrouterRuntimeModel : "__unset__")
    setOrPlannerPick(data.secretsMasked.openrouterPlannerModel?.trim() ? data.secretsMasked.openrouterPlannerModel : "__unset__")

    const avail =
      data.availableOpenAiChatModels && data.availableOpenAiChatModels.length > 0
        ? data.availableOpenAiChatModels
        : [...OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK]
    setAvailableChatModels(avail)
    const en = data.secretsMasked.enabledOpenAiChatModels
    if (en && en.length > 0) setEnabledChatModelsSelection([...en])
    else setEnabledChatModelsSelection([...avail])
    const arm = data.secretsMasked.agentsRuntimeModel
    setAgentsRuntimeModelPick(arm ?? "__unset__")
    const tpm = data.secretsMasked.teamPlannerModel
    setTeamPlannerModelPick(tpm ?? "__unset__")
  }, [])

  useEffect(() => {
    const p = (workspace?.plan ?? "free") as "free" | "pro" | "enterprise"
    setPlatformPlanDraft(p)
  }, [workspace?.plan])

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
            availableOpenAiChatModels: [...OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK],
            allowedLlmModelIds: [],
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
      applyIntegrationsChatState(integrationsRes.data)
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
  }, [token, refreshToken, currentWorkspace, applyIntegrationsChatState])

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

  type TIntegrationPutResponse = {
    message: string
    secretsMasked: IntegrationsApiData["secretsMasked"]
    availableOpenAiChatModels?: string[]
    allowedLlmModelIds?: string[]
    operationalCatalogTools?: IntegrationsApiData["operationalCatalogTools"]
  }

  const mergeIntegrationPutResponse = (res: { data: TIntegrationPutResponse }) => {
    setIntegrations(res.data.secretsMasked)
    applyIntegrationsChatState({
      secretsMasked: res.data.secretsMasked,
      availableOpenAiChatModels: res.data.availableOpenAiChatModels,
      allowedLlmModelIds: res.data.allowedLlmModelIds,
      operationalCatalogTools: res.data.operationalCatalogTools,
    })
  }

  const saveLlmProviderIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        llmProvider: llmProviderPick,
      })
      mergeIntegrationPutResponse(res)
      toast.success("Provedor LLM atualizado")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar provedor LLM")
    } finally {
      setIntBusy(false)
    }
  }

  const saveOpenRouterKeyIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        openrouterApiKey: openrouterKeyInput,
      })
      mergeIntegrationPutResponse(res)
      setOpenrouterKeyInput("")
      toast.success("Chave OpenRouter guardada")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar chave OpenRouter")
    } finally {
      setIntBusy(false)
    }
  }

  const clearOpenRouterKeyIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        openrouterApiKey: "",
      })
      mergeIntegrationPutResponse(res)
      toast.success("Chave OpenRouter removida do workspace")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao remover chave OpenRouter")
    } finally {
      setIntBusy(false)
    }
  }

  const loadOpenRouterCatalog = async () => {
    const api = integrationApi()
    if (!api) return
    setOrCatalogLoading(true)
    try {
      const res = await api.get<{ models: TOpenRouterCatalogRow[]; fetchedAt: number; stale: boolean }>(
        "/settings/workspace/integrations/openrouter-models?mode=all",
      )
      setOrCatalogModels(res.data.models ?? [])
      if (res.data.stale) {
        toast.message("Catálogo servido do cache (OpenRouter indisponível).")
      }
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao carregar catálogo OpenRouter")
    } finally {
      setOrCatalogLoading(false)
    }
  }

  const filteredOrCatalog = useMemo(() => {
    let list = orCatalogModels

    if (orCatalogPriceMode === "free") {
      list = list.filter((m) => m.pricing?.isFree === true)
    } else if (orCatalogPriceMode === "max") {
      const raw = orCatalogMaxUsdPer1mIn.replace(",", ".").trim()
      const max = parseFloat(raw)
      if (Number.isFinite(max) && max >= 0) {
        list = list.filter((m) => {
          const p = m.pricing?.promptUsdPer1M
          return typeof p === "number" && Number.isFinite(p) && p <= max
        })
      }
    }

    const q = orCatalogQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    }

    const promptIn = (m: TOpenRouterCatalogRow) => m.pricing?.promptUsdPer1M
    const listingIdx = (m: TOpenRouterCatalogRow) => m.listingIndex ?? 1e12
    const out = [...list]
    if (orCatalogSort === "popular") {
      out.sort((a, b) => {
        const c = listingIdx(a) - listingIdx(b)
        return c !== 0 ? c : a.id.localeCompare(b.id)
      })
    } else if (orCatalogSort === "id") {
      out.sort((a, b) => a.id.localeCompare(b.id))
    } else if (orCatalogSort === "price_in_asc") {
      out.sort((a, b) => {
        const ap = promptIn(a)
        const bp = promptIn(b)
        const au = ap === null || ap === undefined ? 1 : 0
        const bu = bp === null || bp === undefined ? 1 : 0
        if (au !== bu) return au - bu
        const cmp = (ap ?? 0) - (bp ?? 0)
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      })
    } else {
      out.sort((a, b) => {
        const ap = promptIn(a)
        const bp = promptIn(b)
        const au = ap === null || ap === undefined ? 1 : 0
        const bu = bp === null || bp === undefined ? 1 : 0
        if (au !== bu) return au - bu
        const cmp = (bp ?? 0) - (ap ?? 0)
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
      })
    }
    return out
  }, [
    orCatalogModels,
    orCatalogQuery,
    orCatalogPriceMode,
    orCatalogMaxUsdPer1mIn,
    orCatalogSort,
  ])

  const orModelPickOptions = useMemo(() => {
    if (allowedOrModels.length > 0) {
      const idx = new Map(orCatalogModels.map((m) => [m.id, m.listingIndex ?? 1e12]))
      return [...allowedOrModels].sort((a, b) => {
        const da = idx.get(a) ?? 1e12
        const db = idx.get(b) ?? 1e12
        if (da !== db) return da - db
        return a.localeCompare(b)
      })
    }
    return filteredOrCatalog.map((m) => m.id)
  }, [allowedOrModels, filteredOrCatalog, orCatalogModels])

  const toggleAllowedOrModel = (id: string, checked: boolean) => {
    setAllowedOrModels((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev
        const next = [...prev, id]
        return next.length > 200 ? next.slice(0, 200) : next
      }
      return prev.filter((x) => x !== id)
    })
  }

  const saveOpenRouterModelsIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        allowedLlmModelIds: allowedOrModels,
        openrouterRuntimeModel: orRuntimePick === "__unset__" ? "" : orRuntimePick,
        openrouterPlannerModel: orPlannerPick === "__unset__" ? "" : orPlannerPick,
      })
      mergeIntegrationPutResponse(res)
      toast.success("Modelos OpenRouter guardados")
    } catch (err) {
      toastIntegrationRequestError(err, "Falha ao guardar modelos OpenRouter")
    } finally {
      setIntBusy(false)
    }
  }

  const saveOpenAiIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        openaiApiKey: openaiKeyInput,
      })
      mergeIntegrationPutResponse(res)
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
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", { openaiApiKey: "" })
      mergeIntegrationPutResponse(res)
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
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        imageGenerationModel: imageGenModelDefault === "__default__" ? "" : imageGenModelDefault,
      })
      mergeIntegrationPutResponse(res)
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

  const toggleEnabledChatModel = (modelId: string, checked: boolean) => {
    setEnabledChatModelsSelection((prev) => {
      if (checked) return prev.includes(modelId) ? prev : [...prev, modelId]
      if (prev.length <= 1) return prev
      return prev.filter((m) => m !== modelId)
    })
  }

  const saveOpenAiChatModelsIntegration = async () => {
    const api = integrationApi()
    if (!api) return
    setIntBusy(true)
    try {
      const enabledPayload =
        enabledChatModelsSelection.length === availableChatModels.length ? [] : enabledChatModelsSelection
      const res = await api.put<TIntegrationPutResponse>("/settings/workspace/integrations", {
        enabledOpenAiChatModels: enabledPayload,
        agentsRuntimeModel: agentsRuntimeModelPick === "__unset__" ? "" : agentsRuntimeModelPick,
        teamPlannerModel: teamPlannerModelPick === "__unset__" ? "" : teamPlannerModelPick,
      })
      mergeIntegrationPutResponse(res)
      toast.success("Modelos de chat OpenAI guardados")
    } catch (err) {
      toastIntegrationRequestError(
        err,
        "Falha ao guardar modelos (precisa ser admin e ENCRYPTION_MASTER_KEY no servidor)",
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
      toastIntegrationRequestError(err, "Falha no teste LLM")
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

  const handleApplyPlatformPlan = async () => {
    if (!token || !currentWorkspace?.id) return
    setPlatformPlanBusy(true)
    try {
      await patchWorkspacePlan(currentWorkspace.id, { plan: platformPlanDraft })
      toast.success("Plano do workspace actualizado")
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
      const wr = await api.get<SettingsWorkspaceState>("/settings/workspace")
      setWorkspace(wr.data)
    } catch (err) {
      if (err instanceof ApiError && err.code === "QUOTA_CONFLICT") {
        const conflicts = err.details.conflicts as
          | Array<{ resource: string; used: number; max: number }>
          | undefined
        const msg =
          conflicts && conflicts.length > 0
            ? conflicts.map((c) => `${c.resource}: ${c.used}/${c.max}`).join("; ")
            : err.message
        toast.error(`Nao e possivel reduzir o plano: ${msg}`)
        return
      }
      toastApiRequestError(err, "Nao foi possivel alterar o plano do workspace")
    } finally {
      setPlatformPlanBusy(false)
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
      <ContextualTourHost screenKey="settings" />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configuracoes</h1>
          <p className="text-muted-foreground">
            Gerencie as configuracoes do workspace, perfil e preferencias.
          </p>
        </div>
        <ContextualTourManualTrigger screenKey="settings" />
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

          <WorkspaceVaultCard
            deepLinkNoteId={searchParams.get("vaultNote") ?? undefined}
            deepLinkPartyId={searchParams.get("vaultParty") ?? undefined}
          />

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
                <strong className="text-foreground">Provedor LLM</strong>: escolha <strong>OpenRouter</strong> para
                chat/planner com catálogo oficial de modelos, ou <strong>OpenAI</strong> para o fluxo clássico. A tool{" "}
                <code className="text-xs">image_generation</code> (DALL-E) continua a usar chave OpenAI quando
                configurada.
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
                <strong className="text-foreground">Tools do catalogo</strong>: ligue calendario REST para{" "}
                <code className="text-xs">calendar_access</code>. CRM persistido no produto e via pack de negocio (
                <code className="text-xs">internal_action</code> / <code className="text-xs">crm_*</code>), nao por URL
                generica aqui.
              </p>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Provedor LLM</CardTitle>
              <CardDescription>
                OpenRouter usa o catálogo oficial (<code className="text-xs">/v1/models</code>) para autorizar modelos
                no workspace. OpenAI permanece suportado para compatibilidade e para imagens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llm-provider">Provider ativo</Label>
                <Select
                  value={llmProviderPick}
                  onValueChange={(v) => setLlmProviderPick(v as "openai" | "openrouter")}
                >
                  <SelectTrigger id="llm-provider" className="w-[min(100%,280px)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveLlmProviderIntegration()} disabled={intBusy}>
                  Guardar provider
                </Button>
                <Button type="button" variant="secondary" onClick={() => void runTestOpenAi()} disabled={intBusy}>
                  Testar ligacao LLM
                </Button>
              </div>
            </CardContent>
          </Card>

          {llmProviderPick === "openrouter" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>OpenRouter (BYOK)</CardTitle>
                  <CardDescription>
                    Chave para chat e planner via OpenRouter.{" "}
                    <a
                      href="https://openrouter.ai/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1"
                    >
                      Obter chave <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {integrations?.openrouterApiKeyConfigured ? (
                    <p className="text-sm text-muted-foreground">
                      Configurado:{" "}
                      <span className="font-mono">{integrations.openrouterApiKeyMasked ?? "****"}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      Sem chave no workspace. O servidor pode usar <code className="text-xs">OPENROUTER_API_KEY</code>{" "}
                      em demo local.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="or-key">Nova chave OpenRouter</Label>
                    <Input
                      id="or-key"
                      type="password"
                      autoComplete="off"
                      placeholder="sk-or-v1-..."
                      value={openrouterKeyInput}
                      onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void saveOpenRouterKeyIntegration()}
                      disabled={intBusy || !openrouterKeyInput.trim()}
                    >
                      Guardar OpenRouter
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void clearOpenRouterKeyIntegration()} disabled={intBusy}>
                      Limpar chave
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Modelos OpenRouter (catálogo oficial)</CardTitle>
                  <CardDescription>
                    Carregue o catálogo, marque os modelos permitidos neste workspace e defina os defaults de runtime e
                    planner. Com lista permitida não vazia, os defaults têm de pertencer à lista. A ordem{" "}
                    <strong>Popular</strong> segue a lista OpenRouter (
                    <code className="text-xs">order=most-popular</code>
                    ). Preços em <strong>USD por 1M tokens</strong> (entrada / saída), do campo{" "}
                    <code className="text-xs">pricing</code> — o filtro &quot;grátis&quot; corresponde a entrada e saída
                    a zero (o parâmetro <code className="text-xs">max_price</code> da API de modelos não replica o do
                    site). Ver também no site (ex.{" "}
                    <Link
                      href="https://openrouter.ai/models?order=most-popular&max_price=0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      modelos gratuitos
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                    ).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-end">
                    <Button type="button" variant="secondary" onClick={() => void loadOpenRouterCatalog()} disabled={intBusy || orCatalogLoading}>
                      {orCatalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Carregar catálogo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={intBusy || orCatalogModels.length === 0}
                      onClick={() => {
                        setOrCatalogSort("popular")
                        setOrCatalogPriceMode("free")
                        setOrCatalogMaxUsdPer1mIn("")
                        setOrCatalogQuery("")
                      }}
                      title="Igual à combinação popular + grátis no site OpenRouter"
                    >
                      Popular + grátis
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {orCatalogModels.length > 0 ? `${orCatalogModels.length} modelos em cache` : "Ainda não carregado"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="or-cat-q">Pesquisar</Label>
                      <Input
                        id="or-cat-q"
                        value={orCatalogQuery}
                        onChange={(e) => setOrCatalogQuery(e.target.value)}
                        placeholder="ex. claude, gpt, google/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="or-price-mode">Preço (entrada)</Label>
                      <Select value={orCatalogPriceMode} onValueChange={(v) => setOrCatalogPriceMode(v as "all" | "free" | "max")}>
                        <SelectTrigger id="or-price-mode" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="free">Apenas grátis (0 / 0)</SelectItem>
                          <SelectItem value="max">Máximo USD/1M entrada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="or-sort">Ordenar</Label>
                      <Select
                        value={orCatalogSort}
                        onValueChange={(v) =>
                          setOrCatalogSort(v as "popular" | "id" | "price_in_asc" | "price_in_desc")
                        }
                      >
                        <SelectTrigger id="or-sort" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popular">Popular (OpenRouter)</SelectItem>
                          <SelectItem value="id">ID (A–Z)</SelectItem>
                          <SelectItem value="price_in_asc">Preço entrada ↑</SelectItem>
                          <SelectItem value="price_in_desc">Preço entrada ↓</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {orCatalogPriceMode === "max" ? (
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="or-max-in">Teto USD / 1M tokens de entrada</Label>
                      <Input
                        id="or-max-in"
                        inputMode="decimal"
                        value={orCatalogMaxUsdPer1mIn}
                        onChange={(e) => setOrCatalogMaxUsdPer1mIn(e.target.value)}
                        placeholder="ex. 0 para só grátis, 0.5, 2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Só entram modelos com preço de entrada conhecido e ≤ ao teto. <strong>0</strong> inclui tudo com
                        entrada gratuita (pode ter saída paga); para exigir entrada e saída a zero use o filtro
                        &quot;Apenas grátis&quot;.
                      </p>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 border-b pb-1 text-xs font-medium text-muted-foreground px-1 sm:grid-cols-[auto_1fr_auto_auto]">
                    <span className="w-4 max-sm:hidden" aria-hidden />
                    <span className="max-sm:col-span-2">Modelo</span>
                    <span className="hidden text-right tabular-nums sm:inline sm:w-[5.5rem]">USD/M in</span>
                    <span className="hidden text-right tabular-nums sm:inline sm:w-[5.5rem]">USD/M out</span>
                  </div>
                  <ScrollArea className="h-72 rounded-md border p-2">
                    <div className="space-y-1 pr-3">
                      {filteredOrCatalog.slice(0, 500).map((m) => {
                        const pr = m.pricing
                        const freeBadge = pr?.isFree ? (
                          <Badge variant="secondary" className="ml-1 align-middle text-[10px] font-normal">
                            grátis
                          </Badge>
                        ) : null
                        return (
                          <label
                            key={m.id}
                            className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-sm py-1.5 text-sm sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={allowedOrModels.includes(m.id)}
                              onCheckedChange={(c) => toggleAllowedOrModel(m.id, c === true)}
                            />
                            <span className="min-w-0">
                              <span className="font-mono text-xs break-all">{m.id}</span>
                              {freeBadge}
                              <span className="text-muted-foreground"> — {m.name}</span>
                              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground sm:hidden">
                                in {formatOrUsdPer1m(pr?.promptUsdPer1M)} · out {formatOrUsdPer1m(pr?.completionUsdPer1M)}
                              </span>
                            </span>
                            <span className="hidden font-mono text-xs text-right tabular-nums sm:block sm:w-[5.5rem] sm:justify-self-end">
                              {formatOrUsdPer1m(pr?.promptUsdPer1M)}
                            </span>
                            <span className="hidden font-mono text-xs text-right tabular-nums sm:block sm:w-[5.5rem] sm:justify-self-end">
                              {formatOrUsdPer1m(pr?.completionUsdPer1M)}
                            </span>
                          </label>
                        )
                      })}
                      {filteredOrCatalog.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {orCatalogModels.length === 0
                            ? "Carregue o catálogo para listar modelos."
                            : "Nenhum modelo corresponde aos filtros — alargue o teto de preço ou limpe a pesquisa."}
                        </p>
                      ) : null}
                      {filteredOrCatalog.length > 500 ? (
                        <p className="text-xs text-muted-foreground pt-1">
                          A mostrar os primeiros 500 de {filteredOrCatalog.length} resultados — refine a pesquisa ou o
                          preço.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Modelo default runtime</Label>
                      <Select value={orRuntimePick} onValueChange={setOrRuntimePick}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Escolher..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">Resolver via modelo GPT do workspace (legado)</SelectItem>
                          {orModelPickOptions.map((id) => (
                            <SelectItem key={id} value={id}>
                              {id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo default planner</Label>
                      <Select value={orPlannerPick} onValueChange={setOrPlannerPick}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Escolher..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">Resolver via modelo GPT do workspace (legado)</SelectItem>
                          {orModelPickOptions.map((id) => (
                            <SelectItem key={`p-${id}`} value={id}>
                              {id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="button" onClick={() => void saveOpenRouterModelsIntegration()} disabled={intBusy}>
                    Guardar modelos OpenRouter
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}

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
              <CardTitle>
                {llmProviderPick === "openrouter" ? "OpenAI (opcional — imagens DALL-E)" : "OpenAI (BYOK)"}
              </CardTitle>
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

          {llmProviderPick === "openai" ? (
          <Card>
            <CardHeader>
              <CardTitle>Modelos de chat OpenAI</CardTitle>
              <CardDescription>
                Catalogo fechado no produto. Por defeito o planner usa <code className="text-xs">gpt-5.4</code> e o
                runtime dos agentes <code className="text-xs">gpt-5.4-mini</code>, salvo override aqui ou por agente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelos habilitados neste workspace</Label>
                <p className="text-xs text-muted-foreground">
                  Quando todos estao assinalados, o servidor trata como &quot;todos os modelos do catalogo&quot;. Desmarque
                  para restringir o que aparece nos selects e nos overrides por agente.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableChatModels.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={enabledChatModelsSelection.includes(m)}
                        onCheckedChange={(c) => toggleEnabledChatModel(m, c === true)}
                      />
                      <span className="font-mono">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agents-runtime-model">Modelo padrao do runtime (coordenador + especialistas)</Label>
                  <Select value={agentsRuntimeModelPick} onValueChange={setAgentsRuntimeModelPick}>
                    <SelectTrigger id="agents-runtime-model" className="w-full">
                      <SelectValue placeholder="Escolher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">Usar padrao do produto (gpt-5.4-mini)</SelectItem>
                      {enabledChatModelsSelection.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-planner-model">Modelo padrao do team planner</Label>
                  <Select value={teamPlannerModelPick} onValueChange={setTeamPlannerModelPick}>
                    <SelectTrigger id="team-planner-model" className="w-full">
                      <SelectValue placeholder="Escolher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">Usar padrao do produto (gpt-5.4)</SelectItem>
                      {enabledChatModelsSelection.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="button" onClick={() => void saveOpenAiChatModelsIntegration()} disabled={intBusy}>
                Guardar modelos de chat
              </Button>
            </CardContent>
          </Card>
          ) : null}

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
          {user?.isPlatformAdmin === true && currentWorkspace?.id ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>Plano do workspace (admin global)</CardTitle>
                <CardDescription>
                  Aplica-se ao workspace actual ({currentWorkspace.id}). Downgrade e bloqueado se o uso
                  (times, agentes ou canais) exceder os limites do plano escolhido.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="space-y-2 min-w-[200px] flex-1">
                  <Label htmlFor="platform-plan-select">Plano</Label>
                  <Select
                    value={platformPlanDraft}
                    onValueChange={(v) => setPlatformPlanDraft(v as "free" | "pro" | "enterprise")}
                  >
                    <SelectTrigger id="platform-plan-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">{planLabels.free}</SelectItem>
                      <SelectItem value="pro">{planLabels.pro}</SelectItem>
                      <SelectItem value="enterprise">{planLabels.enterprise}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  disabled={
                    platformPlanBusy ||
                    platformPlanDraft === (workspace?.plan ?? currentWorkspace.plan ?? "free")
                  }
                  onClick={() => void handleApplyPlatformPlan()}
                >
                  {platformPlanBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      A aplicar...
                    </>
                  ) : (
                    "Aplicar plano"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}

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
                  servidor.
                  {user?.isPlatformAdmin !== true ? (
                    <>
                      {" "}
                      Para alterar o plano, utilize um administrador global (ou contacte suporte).
                    </>
                  ) : (
                    <> Administrador global: use o cartao acima para definir o plano.</>
                  )}
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
