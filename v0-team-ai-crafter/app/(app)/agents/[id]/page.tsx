"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import type {
  Agent,
  AgentExportPayload,
  AgentMCPBinding,
  BusinessActionDomain,
  KnowledgeSource,
  MCPConnection,
  OperationalCatalogTool,
  Team,
} from "@/lib/types"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { toast } from "sonner"
import {
  ArrowLeft,
  Crown,
  Target,
  Brain,
  Wrench,
  Plug,
  Shield,
  Users,
  Settings2,
  Plus,
  Trash2,
  Database,
  FileText,
  Globe,
  Zap,
  Check,
  AlertCircle,
  Info,
  Download,
  ClipboardCopy,
  Library,
  Loader2,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { CardTitleWithInfo, FieldInfo, LabelWithInfo } from "@/components/agents/field-info"
import { agentFieldHelp } from "@/lib/copy/agent-field-help"
import { normalizeAgentCategory } from "@/lib/utils/agent-category"
import { copyJsonToClipboard, downloadJsonFile } from "@/lib/utils/export-json"
import { buildWorkspaceSecondBrainHref, vaultNotesEmptyCopy } from "@/lib/vault/ui-state"

const accessLevelLabels: Record<string, string> = {
  read: "Leitura",
  write: "Escrita",
  restricted: "Restrito",
}

const knowledgeTypeIcons: Record<string, typeof Database> = {
  document: FileText,
  database: Database,
  api: Zap,
  website: Globe,
}

const OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK: readonly string[] = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
]

/** Mesma forma que `secretsMasked` no GET /integrations (fallback do catch precisa do mesmo tipo para não unir com branch estreita). */
type AgentPageIntegrationsSecretsMasked = {
  llmProvider?: "openai" | "openrouter"
  openaiApiKeyConfigured: boolean
  openrouterApiKeyConfigured?: boolean
  enabledOpenAiChatModels?: string[]
  allowedLlmModelIds?: string[]
}

type AgentPageOpenRouterCatalogRow = {
  id: string
  outputModalities?: string[]
}

const integrationsSecretsMaskedFallback: AgentPageIntegrationsSecretsMasked = {
  openaiApiKeyConfigured: false,
}

type TBusinessCatalogItem = {
  actionId: string
  title: string
  description: string
  packId?: string
  toolKind?: "coordination" | "primitive" | "composite_workflow" | "read_model" | "admin_diagnostic"
  riskLevel?: "low" | "medium" | "high"
  ownerAgent?: string
  uiExposureMode?: "primary" | "advanced" | "hidden"
  domainScope?: string
  replacesPrimitiveActions?: string[]
}

function describeWorkspaceToolConfig(
  tool: {
    kind: string
    config?: Record<string, unknown>
  },
  catalogByActionId?: Record<
    string,
    {
      title: string
      packId?: string
      toolKind?: TBusinessCatalogItem["toolKind"]
      riskLevel?: TBusinessCatalogItem["riskLevel"]
      ownerAgent?: string
      uiExposureMode?: TBusinessCatalogItem["uiExposureMode"]
    }
  >,
): string | null {
  if (tool.kind === "internal_action") {
    const aid = typeof tool.config?.actionId === "string" ? tool.config.actionId : ""
    if (!aid) return "Acao interna do backend"
    const meta = catalogByActionId?.[aid]
    if (meta) {
      return `${meta.title} — ${aid}${meta.packId ? ` (pack: ${meta.packId})` : ""}`
    }
    return aid
  }
  if (tool.kind === "http_webhook") {
    return typeof tool.config?.url === "string" ? String(tool.config.url) : "Webhook HTTP"
  }
  if (tool.kind === "builtin_ref") {
    return typeof tool.config?.builtinId === "string" ? `builtin:${String(tool.config.builtinId)}` : "Builtin"
  }
  if (tool.kind === "mcp_ref") {
    return typeof tool.config?.toolName === "string" ? `mcp:${String(tool.config.toolName)}` : "Referencia MCP"
  }
  return null
}

export default function AgentDetailsPage({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [isMCPBindingOpen, setIsMCPBindingOpen] = useState(false)
  const [selectedMCP, setSelectedMCP] = useState<string | null>(null)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [bindingRequiresApproval, setBindingRequiresApproval] = useState(false)

  const [agent, setAgent] = useState<Agent | null>(null)
  const [mcps, setMcps] = useState<MCPConnection[]>([])
  const [bindings, setBindings] = useState<AgentMCPBinding[]>([])
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [saving, setSaving] = useState(false)
  const [missionGoal, setMissionGoal] = useState("")
  const [responsibilities, setResponsibilities] = useState<string[]>([])
  const [systemInstruction, setSystemInstruction] = useState("")
  const [knowledgeSourceIds, setKnowledgeSourceIds] = useState<string[]>([])
  const [useSessionMemory, setUseSessionMemory] = useState(true)
  const [usePersistentMemory, setUsePersistentMemory] = useState(false)
  const [fixedContext, setFixedContext] = useState("")
  const [enabledTools, setEnabledTools] = useState<string[]>([])
  const [openaiBuiltInTools, setOpenaiBuiltInTools] = useState<string[]>([])
  const [customToolDefinitionIds, setCustomToolDefinitionIds] = useState<string[]>([])
  const [workspaceToolDefs, setWorkspaceToolDefs] = useState<
    Array<{
      id: string
      name: string
      slug: string
      enabled: boolean
      kind: "builtin_ref" | "http_webhook" | "mcp_ref" | "internal_action"
      config?: Record<string, unknown>
    }>
  >([])
  const [securityAccessLevel, setSecurityAccessLevel] = useState<"read" | "write" | "restricted">("read")
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [workspaceLlmConfigured, setWorkspaceLlmConfigured] = useState<boolean | null>(null)
  const [chatModelsForAgentSelect, setChatModelsForAgentSelect] = useState<string[]>([])
  const [imageModelsForAgentSelect, setImageModelsForAgentSelect] = useState<string[]>([])
  const [openaiRuntimeModelPick, setOpenaiRuntimeModelPick] = useState<string>("__unset__")
  const [imageGenerationModelPick, setImageGenerationModelPick] = useState<string>("__unset__")
  const [operationalCatalogTools, setOperationalCatalogTools] = useState<OperationalCatalogTool[]>([])
  const [businessActionCatalog, setBusinessActionCatalog] = useState<TBusinessCatalogItem[]>([])
  const [businessDomains, setBusinessDomains] = useState<BusinessActionDomain[]>([])
  const [domainBusy, setDomainBusy] = useState<string | null>(null)
  const [workspaceToolFilterKind, setWorkspaceToolFilterKind] = useState<string>("all")
  const [workspaceToolFilterDomain, setWorkspaceToolFilterDomain] = useState<string>("all")
  const [workspaceToolFilterRisk, setWorkspaceToolFilterRisk] = useState<string>("all")
  const [workspaceToolFilterExposure, setWorkspaceToolFilterExposure] = useState<string>("all")
  const [workspaceToolFilterOwner, setWorkspaceToolFilterOwner] = useState<string>("all")
  const [exportJsonBusy, setExportJsonBusy] = useState(false)

  type AgentVaultNoteRow = {
    noteId: string
    status: string
    kind: string
    title: string
    bodyPreview: string
    contentHash?: string
    version?: number
    partyId?: string
  }
  const [vaultNotes, setVaultNotes] = useState<AgentVaultNoteRow[]>([])
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultNotesLoadError, setVaultNotesLoadError] = useState<"forbidden" | "network" | null>(null)
  const [mainTab, setMainTab] = useState("overview")
  const [vaultPartyFilter, setVaultPartyFilter] = useState<string>("")
  const [partyOptions, setPartyOptions] = useState<Array<{ id: string; displayName: string }>>([])
  const [vaultEditOpen, setVaultEditOpen] = useState(false)
  const [vaultEditBusy, setVaultEditBusy] = useState(false)
  const [vaultEditDraft, setVaultEditDraft] = useState<{
    noteId: string
    title: string
    body: string
    contentHash: string
  } | null>(null)
  const vaultNoteRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const applyAgentPayload = useCallback(
    (a: Agent, options?: { operationalCatalogToolIds?: Set<string> }) => {
    setAgent(a)
    setMissionGoal(a.goal ?? "")
    setResponsibilities(a.responsibilities ?? [])
    setSystemInstruction(a.systemInstruction ?? "")
    setKnowledgeSourceIds(a.knowledge?.sources ?? [])
    setUseSessionMemory(a.knowledge?.useSessionMemory ?? true)
    setUsePersistentMemory(a.knowledge?.usePersistentMemory ?? false)
    setFixedContext(a.knowledge?.fixedContext ?? "")
    if (options?.operationalCatalogToolIds) {
      setEnabledTools(
        (a.capabilities?.platformBuiltInTools ?? a.capabilities?.tools ?? []).filter((id) =>
          options.operationalCatalogToolIds!.has(id),
        ),
      )
    } else {
      setEnabledTools(a.capabilities?.platformBuiltInTools ?? a.capabilities?.tools ?? [])
    }
    setOpenaiBuiltInTools(a.capabilities?.openaiBuiltInTools ?? [])
    setCustomToolDefinitionIds(a.capabilities?.customToolDefinitionIds ?? [])
    setSecurityAccessLevel((a.security?.accessLevel ?? "read") as "read" | "write" | "restricted")
    setRequiresApproval(a.security?.requiresApproval ?? false)
    setOpenaiRuntimeModelPick(a.openaiRuntimeModel ?? "__unset__")
    setImageGenerationModelPick(a.imageGenerationModel ?? "__unset__")
  },
  [],
)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      try {
        const [agentRes, mcpsRes, bindingsRes, knowledgeRes, teamsRes, toolDefsRes, integrationsRes, catalogRes, domainsRes] =
          await Promise.all([
          api.get<Agent>(`/agents/${id}`),
          api.get<MCPConnection[]>("/mcps"),
          api.get<AgentMCPBinding[]>(`/agents/${id}/mcp-bindings`),
          api.get<KnowledgeSource[]>("/knowledge-sources"),
          api.get<Team[]>(`/teams?page=1&perPage=100`),
          api
            .get<
              Array<{
                id: string
                name: string
                slug: string
                enabled: boolean
                kind: "builtin_ref" | "http_webhook" | "mcp_ref" | "internal_action"
                config?: Record<string, unknown>
              }>
            >("/tool-definitions")
            .catch(() => ({ data: [], meta: {} })),
          api
            .get<{
              allowedLlmModelIds?: string[]
              secretsMasked: AgentPageIntegrationsSecretsMasked
              operationalCatalogTools: OperationalCatalogTool[]
              availableOpenAiChatModels?: string[]
            }>("/settings/workspace/integrations")
            .catch(() => ({
              data: {
                secretsMasked: integrationsSecretsMaskedFallback,
                operationalCatalogTools: [] as OperationalCatalogTool[],
                availableOpenAiChatModels: [...OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK],
                allowedLlmModelIds: [] as string[],
              },
              meta: {},
            })),
          api.get<TBusinessCatalogItem[]>("/business-actions/catalog").catch(() => ({ data: [], meta: {} })),
          api.get<BusinessActionDomain[]>("/business-actions/domains").catch(() => ({ data: [], meta: {} })),
        ])
        const opTools = integrationsRes.data.operationalCatalogTools ?? []
        setOperationalCatalogTools(opTools)
        const opIds = new Set(opTools.map((tool) => tool.id))
        applyAgentPayload(agentRes.data, { operationalCatalogToolIds: opIds })
        const intPayload = integrationsRes.data
        const sm = intPayload.secretsMasked
        const prov = sm.llmProvider === "openai" ? "openai" : "openrouter"
        const llmReady =
          prov === "openrouter"
            ? Boolean(sm.openrouterApiKeyConfigured)
            : Boolean(sm.openaiApiKeyConfigured)
        setWorkspaceLlmConfigured(llmReady)
        if (prov === "openrouter") {
          const allowed = [
            ...(sm.allowedLlmModelIds?.length ? sm.allowedLlmModelIds : intPayload.allowedLlmModelIds ?? []),
          ].filter(Boolean)
          try {
            const cat = await api.get<{ models: AgentPageOpenRouterCatalogRow[] }>(
              "/settings/workspace/integrations/openrouter-models?mode=all",
            )
            const rows = cat.data.models ?? []
            const allowedSet = new Set(allowed)
            const scoped = allowed.length > 0 ? rows.filter((m) => allowedSet.has(m.id)) : rows
            const isText = (m: AgentPageOpenRouterCatalogRow) => {
              const out = m.outputModalities ?? []
              return out.length === 0 || out.includes("text")
            }
            const isImage = (m: AgentPageOpenRouterCatalogRow) => (m.outputModalities ?? []).includes("image")
            const chat = scoped.filter(isText).map((m) => m.id)
            const image = scoped.filter(isImage).map((m) => m.id)
            setChatModelsForAgentSelect(chat.length > 0 ? chat : [...new Set(allowed)].sort((a, b) => a.localeCompare(b)))
            setImageModelsForAgentSelect(image.length > 0 ? image : [...new Set(allowed)].sort((a, b) => a.localeCompare(b)))
          } catch {
            const fallback = [...new Set(allowed)].sort((a, b) => a.localeCompare(b))
            setChatModelsForAgentSelect(fallback)
            setImageModelsForAgentSelect(fallback)
          }
        } else {
          const avail =
            intPayload.availableOpenAiChatModels && intPayload.availableOpenAiChatModels.length > 0
              ? intPayload.availableOpenAiChatModels
              : [...OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK]
          const en =
            "enabledOpenAiChatModels" in sm && Array.isArray(sm.enabledOpenAiChatModels)
              ? sm.enabledOpenAiChatModels
              : undefined
          const choices = en && en.length > 0 ? avail.filter((m) => en.includes(m)) : [...avail]
          setChatModelsForAgentSelect(choices.length > 0 ? choices : [...avail])
          setImageModelsForAgentSelect(["dall-e-2", "dall-e-3"])
        }
        setMcps(mcpsRes.data)
        setBindings(bindingsRes.data)
        setKnowledgeSources(knowledgeRes.data)
        setTeams(teamsRes.data)
        setWorkspaceToolDefs(toolDefsRes.data)
        setBusinessActionCatalog(Array.isArray(catalogRes.data) ? catalogRes.data : [])
        setBusinessDomains(Array.isArray(domainsRes.data) ? domainsRes.data : [])
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Falha ao carregar agente"
        toast.error(msg)
      }
    })()
  }, [token, refreshToken, currentWorkspace, id, applyAgentPayload])

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  const enableDomainForAgent = async (domainId: string) => {
    if (!api || !agent) return
    setDomainBusy(domainId)
    try {
      const res = await api.put<{
        capabilities: Agent["capabilities"]
      }>(`/agents/${agent.id}/domains`, { domainIds: [domainId] })
      setEnabledTools(res.data.capabilities?.platformBuiltInTools ?? res.data.capabilities?.tools ?? [])
      setOpenaiBuiltInTools(res.data.capabilities?.openaiBuiltInTools ?? [])
      setCustomToolDefinitionIds(res.data.capabilities?.customToolDefinitionIds ?? [])
      const toolDefsRes = await api.get<typeof workspaceToolDefs>("/tool-definitions")
      setWorkspaceToolDefs(toolDefsRes.data)
      toast.success("Domínio habilitado para o agente")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao habilitar domínio")
    } finally {
      setDomainBusy(null)
    }
  }

  const refreshVaultNotes = useCallback(async () => {
    if (!api || !id) return
    setVaultLoading(true)
    setVaultNotesLoadError(null)
    try {
      const path = vaultPartyFilter.trim()
        ? `/vault/parties/${encodeURIComponent(vaultPartyFilter.trim())}/notes?limit=120`
        : `/vault/notes?agentId=${encodeURIComponent(id)}&limit=120`
      const res = await api.get<AgentVaultNoteRow[]>(path)
      setVaultNotes(res.data)
    } catch (e) {
      setVaultNotes([])
      if (e instanceof ApiError && e.status === 403) {
        setVaultNotesLoadError("forbidden")
      } else {
        setVaultNotesLoadError("network")
      }
    } finally {
      setVaultLoading(false)
    }
  }, [api, id, vaultPartyFilter])

  useEffect(() => {
    void refreshVaultNotes()
  }, [refreshVaultNotes])

  useEffect(() => {
    if (searchParams.get("vaultTab") === "vault") {
      setMainTab("vault")
    }
  }, [searchParams])

  useEffect(() => {
    const party = searchParams.get("vaultParty")?.trim()
    if (party) setVaultPartyFilter(party)
  }, [searchParams])

  useEffect(() => {
    if (!api) return
    void (async () => {
      try {
        const res = await api.get<Array<{ id: string; displayName: string }>>("/parties?limit=50")
        setPartyOptions(Array.isArray(res.data) ? res.data : [])
      } catch {
        setPartyOptions([])
      }
    })()
  }, [api])

  const vaultLiveTeamId = useMemo(() => {
    if (!id || teams.length === 0) return null
    const hit = teams.find((t) => t.agentIds?.includes(id))
    return hit?.id ?? teams[0]?.id ?? null
  }, [id, teams])

  useEffect(() => {
    if (!api || !vaultLiveTeamId || mainTab !== "vault") return
    const ac = new AbortController()
    void api.streamTeamLive(
      vaultLiveTeamId,
      {
        onVaultNoteChanged: () => {
          void refreshVaultNotes()
        },
      },
      ac.signal,
    )
    return () => ac.abort()
  }, [api, vaultLiveTeamId, mainTab, refreshVaultNotes])

  const vaultScrollTarget = searchParams.get("vaultNote")
  useEffect(() => {
    if (!vaultScrollTarget || vaultNotes.length === 0) return
    const el = vaultNoteRefs.current[vaultScrollTarget]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [vaultScrollTarget, vaultNotes])

  const handleExportAgentJsonDownload = useCallback(async () => {
    if (!api || !agent) return
    setExportJsonBusy(true)
    try {
      const res = await api.get<AgentExportPayload>(`/agents/${agent.id}/export`)
      downloadJsonFile(`agent-${agent.id}-export.json`, res.data)
      toast.success("Configuracao exportada")
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao exportar"
      toast.error(msg)
    } finally {
      setExportJsonBusy(false)
    }
  }, [api, agent])

  const handleExportAgentJsonCopy = useCallback(async () => {
    if (!api || !agent) return
    setExportJsonBusy(true)
    try {
      const res = await api.get<AgentExportPayload>(`/agents/${agent.id}/export`)
      await copyJsonToClipboard(res.data)
      toast.success("JSON copiado para a area de transferencia")
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao copiar"
      toast.error(msg)
    } finally {
      setExportJsonBusy(false)
    }
  }, [api, agent])

  const businessActionCatalogById = useMemo(() => {
    const m: Record<
      string,
      {
        title: string
        packId?: string
        toolKind?: TBusinessCatalogItem["toolKind"]
        riskLevel?: TBusinessCatalogItem["riskLevel"]
        ownerAgent?: string
        uiExposureMode?: TBusinessCatalogItem["uiExposureMode"]
        domainScope?: string
        replacesPrimitiveActions?: string[]
      }
    > = {}
    for (const c of businessActionCatalog) {
      m[c.actionId] = {
        title: c.title,
        packId: c.packId,
        toolKind: c.toolKind,
        riskLevel: c.riskLevel,
        ownerAgent: c.ownerAgent,
        uiExposureMode: c.uiExposureMode,
        domainScope: c.domainScope,
        replacesPrimitiveActions: c.replacesPrimitiveActions,
      }
    }
    return m
  }, [businessActionCatalog])
  const primitiveReplacementByActionId = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const c of businessActionCatalog) {
      for (const primitiveId of c.replacesPrimitiveActions ?? []) {
        if (!out[primitiveId]) out[primitiveId] = []
        out[primitiveId].push(c.title)
      }
    }
    return out
  }, [businessActionCatalog])

  const boundMCPIds = bindings.map((b) => b.mcpConnectionId)
  const availableMCPsForBinding = mcps.filter(
    (m) => !boundMCPIds.includes(m.id) && m.status === "connected",
  )
  const activeWorkspaceToolDefs = workspaceToolDefs.filter((toolDef) => toolDef.enabled)
  const inactiveWorkspaceToolDefs = workspaceToolDefs.filter((toolDef) => !toolDef.enabled)
  const selectedWorkspaceToolCount = customToolDefinitionIds.length
  const workspaceToolDomainOptions = useMemo(() => {
    return Array.from(
      new Set(
        businessActionCatalog
          .map((c) => c.domainScope?.trim())
          .filter((v): v is string => Boolean(v)),
      ),
    ).sort()
  }, [businessActionCatalog])
  const workspaceToolOwnerOptions = useMemo(() => {
    return Array.from(
      new Set(
        businessActionCatalog
          .map((c) => c.ownerAgent?.trim())
          .filter((v): v is string => Boolean(v)),
      ),
    ).sort()
  }, [businessActionCatalog])
  const filteredWorkspaceToolDefs = useMemo(() => {
    return activeWorkspaceToolDefs.filter((def) => {
      if (def.kind !== "internal_action" || typeof def.config?.actionId !== "string") return true
      const meta = businessActionCatalogById[def.config.actionId]
      if (!meta) return true
      if (workspaceToolFilterKind !== "all" && meta.toolKind !== workspaceToolFilterKind) return false
      if (workspaceToolFilterDomain !== "all" && meta.domainScope !== workspaceToolFilterDomain) return false
      if (workspaceToolFilterRisk !== "all" && meta.riskLevel !== workspaceToolFilterRisk) return false
      if (workspaceToolFilterExposure !== "all" && meta.uiExposureMode !== workspaceToolFilterExposure) return false
      if (workspaceToolFilterOwner !== "all" && meta.ownerAgent !== workspaceToolFilterOwner) return false
      return true
    })
  }, [
    activeWorkspaceToolDefs,
    businessActionCatalogById,
    workspaceToolFilterKind,
    workspaceToolFilterDomain,
    workspaceToolFilterRisk,
    workspaceToolFilterExposure,
    workspaceToolFilterOwner,
  ])

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Agente nao encontrado</p>
      </div>
    )
  }

  const readOnly = agent.origin === "whitebeard"

  const agentTeams = teams.filter((t) => t.coordinatorId === agent.id || t.agentIds.includes(agent.id))

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSave = async () => {
    if (!api) return
    if (readOnly) {
      toast.error(
        "Agentes do catalogo Whitebeard sao somente leitura. Duplique ou crie um agente da empresa para editar.",
      )
      return
    }
    setSaving(true)
    toast.info("Salvando...")
    try {
      const saveSteps = [
        {
          label: "Dados basicos",
          run: () => {
            const payload: Record<string, unknown> = {
              name: agent.name,
              description: agent.description,
              skills: agent.skills,
              category: normalizeAgentCategory(String(agent.category ?? "")),
            }
            if (agent.role === "coordinator") {
              payload.channels = agent.channels
            }
            return api.put(`/agents/${agent.id}`, payload)
          },
        },
        {
          label: "Missao",
          run: () =>
            api.put(`/agents/${agent.id}/mission`, {
              goal: missionGoal,
              responsibilities,
            }),
        },
        {
          label: "Conhecimento",
          run: () =>
            api.put(`/agents/${agent.id}/knowledge`, {
              sources: knowledgeSourceIds,
              useSessionMemory,
              usePersistentMemory,
              fixedContext: fixedContext || undefined,
            }),
        },
        {
          label: "Ferramentas",
          run: () =>
            api.put(`/agents/${agent.id}/tools`, {
              tools: enabledTools,
              platformBuiltInTools: enabledTools,
              openaiBuiltInTools,
              customToolDefinitionIds,
            }),
        },
        {
          label: "Seguranca",
          run: () =>
            api.put(`/agents/${agent.id}/security`, {
              requiresApproval,
              accessLevel: securityAccessLevel,
            }),
        },
        {
          label: "Config",
          run: () =>
            api.put(`/agents/${agent.id}/config`, {
              systemInstruction,
              openaiRuntimeModel: openaiRuntimeModelPick === "__unset__" ? null : openaiRuntimeModelPick,
              imageGenerationModel: imageGenerationModelPick === "__unset__" ? null : imageGenerationModelPick,
            }),
        },
      ]

      const results = await Promise.allSettled(saveSteps.map((s) => s.run()))
      const errors: string[] = []
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const reason = r.reason
          if (reason instanceof ApiError) {
            const codePart = reason.code ? ` (${reason.code})` : ""
            errors.push(`${saveSteps[i].label}: ${reason.message}${codePart}`)
          } else {
            errors.push(`${saveSteps[i].label}: falha desconhecida`)
          }
        }
      })

      if (errors.length > 0) {
        const summary =
          errors.slice(0, 4).join(" | ") + (errors.length > 4 ? " | ..." : "")
        toast.error(summary)
        return
      }

      toast.success("Alteracoes salvas com sucesso")
      const [agentFreshRes, integrationsFreshRes] = await Promise.all([
        api.get<Agent>(`/agents/${id}`),
        api.get<{
          allowedLlmModelIds?: string[]
          secretsMasked: AgentPageIntegrationsSecretsMasked
          operationalCatalogTools: OperationalCatalogTool[]
          availableOpenAiChatModels?: string[]
        }>("/settings/workspace/integrations"),
      ])
      const opTools = integrationsFreshRes.data.operationalCatalogTools ?? []
      setOperationalCatalogTools(opTools)
      const opIds = new Set(opTools.map((tool) => tool.id))
      applyAgentPayload(agentFreshRes.data, { operationalCatalogToolIds: opIds })
      const intData = integrationsFreshRes.data
      const smFresh = intData.secretsMasked
      const provFresh = smFresh.llmProvider === "openai" ? "openai" : "openrouter"
      setWorkspaceLlmConfigured(
        provFresh === "openrouter"
          ? Boolean(smFresh.openrouterApiKeyConfigured)
          : Boolean(smFresh.openaiApiKeyConfigured),
      )
      if (provFresh === "openrouter") {
        const allowedFresh = [
          ...(smFresh.allowedLlmModelIds?.length ? smFresh.allowedLlmModelIds : intData.allowedLlmModelIds ?? []),
        ].filter(Boolean)
        if (allowedFresh.length > 0) {
          setChatModelsForAgentSelect([...new Set(allowedFresh)].sort((a, b) => a.localeCompare(b)))
        } else {
          try {
            const cat = await api.get<{ models: { id: string }[] }>(
              "/settings/workspace/integrations/openrouter-models?mode=runtime",
            )
            setChatModelsForAgentSelect((cat.data.models ?? []).map((m) => m.id))
          } catch {
            setChatModelsForAgentSelect([])
          }
        }
      } else {
        const availFresh =
          intData.availableOpenAiChatModels && intData.availableOpenAiChatModels.length > 0
            ? intData.availableOpenAiChatModels
            : [...OPENAI_WORKSPACE_CHAT_MODELS_FALLBACK]
        const enFresh = intData.secretsMasked.enabledOpenAiChatModels
        const choicesFresh =
          enFresh && enFresh.length > 0 ? availFresh.filter((m) => enFresh.includes(m)) : [...availFresh]
        setChatModelsForAgentSelect(choicesFresh.length > 0 ? choicesFresh : [...availFresh])
      }
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} (${e.code})` : "Falha ao salvar"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleAddMCPBinding = async () => {
    if (readOnly) {
      toast.error(
        "Agentes do catalogo Whitebeard sao somente leitura. Duplique ou crie um agente da empresa para editar.",
      )
      return
    }
    if (!selectedMCP) return
    if (!api) return
    try {
      const res = await api.post<AgentMCPBinding>(`/agents/${agent.id}/mcp-bindings`, {
        mcpConnectionId: selectedMCP,
        allowedTools: selectedTools,
        requiresApproval: bindingRequiresApproval,
      })
      setBindings((prev) => [...prev, res.data])
      toast.success("MCP vinculado com sucesso")
      setIsMCPBindingOpen(false)
      setSelectedMCP(null)
      setSelectedTools([])
      setBindingRequiresApproval(false)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao vincular MCP"
      toast.error(msg)
    }
  }

  const handleRemoveBinding = async (bindingId: string) => {
    if (readOnly) {
      toast.error(
        "Agentes do catalogo Whitebeard sao somente leitura. Duplique ou crie um agente da empresa para editar.",
      )
      return
    }
    if (!api) return
    try {
      await api.del(`/agents/${agent.id}/mcp-bindings/${bindingId}`)
      setBindings((prev) => prev.filter((b) => b.id !== bindingId))
      toast.success("Vinculo removido com sucesso")
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao remover vinculo"
      toast.error(msg)
    }
  }

  const selectedMCPData = mcps.find((m) => m.id === selectedMCP)
  const normalizedCategory = typeof agent.category === "string" ? agent.category : ""
  const normalizedSkills = Array.isArray(agent.skills) ? agent.skills : []
  const skillsCsv = normalizedSkills.join(", ")

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="agent_detail" />
      {workspaceLlmConfigured === false && agent.origin === "company" ? (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Chave LLM do workspace</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90 flex flex-col sm:flex-row sm:items-center gap-3">
            <span>
              Nao ha chave BYOK do provider LLM ativo neste workspace. O runtime precisa dela em producao
              multi-tenant, ou de <code className="text-xs bg-background/50 px-1 rounded">OPENROUTER_API_KEY</code> /{" "}
              <code className="text-xs bg-background/50 px-1 rounded">OPENAI_API_KEY</code> no servidor (apenas demo
              local).
            </span>
            <Button asChild variant="secondary" size="sm" className="w-fit shrink-0">
              <Link href="/settings?tab=integrations">Configurar integracoes</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-16 h-16 rounded-xl">
            <AvatarFallback
              className={`rounded-xl text-lg font-semibold ${
                agent.role === "coordinator"
                  ? "bg-primary/20 text-primary"
                  : "bg-accent/20 text-accent"
              }`}
            >
              {agent.origin === "whitebeard" ? (
                <AgentWhitebeardIcon className="size-14 shrink-0" aria-hidden />
              ) : (
                getInitials(agent.name)
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{agent.name}</h1>
              <FieldInfo ariaLabel="Ajuda sobre nome e origem do agente">{agentFieldHelp.agentNameHeader}</FieldInfo>
              {agent.role === "coordinator" && (
                <Crown className="w-5 h-5 text-warning" />
              )}
              <Badge
                variant={agent.status === "active" ? "default" : agent.status === "draft" ? "secondary" : "outline"}
              >
                {agent.status === "active" ? "Ativo" : agent.status === "draft" ? "Rascunho" : "Arquivado"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {agent.origin === "whitebeard" ? "Whitebeard" : "Minha Empresa"} - v{agent.version}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-4">
          <ContextualTourManualTrigger screenKey="agent_detail" className="w-full sm:w-auto" />
          <div className="flex items-center gap-2">
            <Label htmlFor="advanced-mode" className="text-sm text-muted-foreground">
              Modo avancado
            </Label>
            <FieldInfo ariaLabel="Ajuda sobre modo avançado">{agentFieldHelp.advancedMode}</FieldInfo>
            <Switch
              id="advanced-mode"
              checked={isAdvancedMode}
              onCheckedChange={setIsAdvancedMode}
              disabled={readOnly}
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!api || exportJsonBusy}
              onClick={handleExportAgentJsonDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!api || exportJsonBusy}
              onClick={handleExportAgentJsonCopy}
            >
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copiar JSON
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || readOnly}>
              {readOnly ? "Somente leitura" : saving ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </div>
        </div>
      </div>

      {readOnly && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Catalogo Whitebeard (somente leitura)</AlertTitle>
          <AlertDescription>
            Este agente vem do catalogo e nao pode ser alterado nesta conta. Para personalizar, duplique o
            agente ou crie um novo agente da empresa.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <div className="-mx-1 w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0 lg:overflow-visible lg:pb-0">
          <TabsList className="inline-flex h-auto min-h-10 w-max flex-nowrap justify-start gap-0.5 p-[3px] lg:grid lg:h-auto lg:w-full lg:grid-cols-7 lg:gap-0">
          <TabsTrigger value="overview" className="flex shrink-0 items-center gap-2">
            <AgentWhitebeardIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Visao Geral</span>
          </TabsTrigger>
          <TabsTrigger value="mission" className="flex shrink-0 items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Missao</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex shrink-0 items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Conhecimento</span>
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex shrink-0 items-center gap-2">
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">Second-brain</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex shrink-0 items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Ferramentas</span>
          </TabsTrigger>
          <TabsTrigger value="mcps" className="flex shrink-0 items-center gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">MCPs</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex shrink-0 items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Seguranca</span>
          </TabsTrigger>
        </TabsList>
        </div>

        <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0 space-y-6">

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitleWithInfo title="Informacoes Basicas" infoAriaLabel="Ajuda sobre informações básicas do agente">
                  <p>
                    Nome e origem do agente vêm da criação. Ajuste aqui descrição, categoria e skills para organizar e
                    orientar o runtime.
                  </p>
                </CardTitleWithInfo>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <LabelWithInfo
                    htmlFor="agent-description"
                    className="text-muted-foreground"
                    labelText="Descricao"
                    infoAriaLabel="Ajuda sobre a descrição do agente"
                  >
                    {agentFieldHelp.description}
                  </LabelWithInfo>
                  <Textarea
                    id="agent-description"
                    value={agent.description ?? ""}
                    onChange={(e) =>
                      setAgent((prev) => (prev ? { ...prev, description: e.target.value } : null))
                    }
                    placeholder="Descreva o papel deste agente..."
                    rows={4}
                    className="mt-1 resize-y min-h-20"
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1">
                      <Label className="text-muted-foreground">Funcao</Label>
                      <FieldInfo ariaLabel="Ajuda sobre a função do agente">{agentFieldHelp.role}</FieldInfo>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`mt-1 ${
                        agent.role === "coordinator"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {agent.role === "coordinator" ? "Coordenador" : "Especialista"}
                    </Badge>
                  </div>
                  <div>
                    <LabelWithInfo
                      htmlFor="agent-category"
                      className="text-muted-foreground"
                      labelText="Categoria"
                      infoAriaLabel="Ajuda sobre categoria do agente"
                    >
                      {agentFieldHelp.category}
                    </LabelWithInfo>
                    <Input
                      id="agent-category"
                      value={normalizedCategory}
                      onChange={(e) =>
                        setAgent((prev) => (prev ? { ...prev, category: e.target.value } : null))
                      }
                      className="mt-1"
                      placeholder="Ex.: Vendas, Suporte, Financeiro..."
                    />
                  </div>
                </div>
                <Separator />
                <div>
                  <LabelWithInfo
                    htmlFor="agent-skills"
                    className="text-muted-foreground"
                    labelText="Skills (separadas por virgula)"
                    infoAriaLabel="Ajuda sobre skills do agente"
                  >
                    {agentFieldHelp.skills}
                  </LabelWithInfo>
                  <Input
                    id="agent-skills"
                    value={skillsCsv}
                    onChange={(e) => {
                      const next = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                      setAgent((prev) => (prev ? { ...prev, skills: next } : null))
                    }}
                    className="mt-1"
                    placeholder="Ex.: atendimento, copywriting, sql"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {normalizedSkills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitleWithInfo title="Resumo de Configuracao" infoAriaLabel="Ajuda sobre o resumo de configuração">
                  {agentFieldHelp.configSummary}
                </CardTitleWithInfo>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Plug className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{bindings.length}</p>
                      <p className="text-xs text-muted-foreground">MCPs Conectados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Wrench className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-sm font-medium">{agent.capabilities?.tools?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Catalogo operacional</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Settings2 className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-sm font-medium">{selectedWorkspaceToolCount}</p>
                      <p className="text-xs text-muted-foreground">Tools do workspace</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Brain className="w-5 h-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium">{agent.knowledge?.sources?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Fontes de Conhecimento</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-1">
                    <Label className="text-muted-foreground">Times</Label>
                    <FieldInfo ariaLabel="Ajuda sobre times do agente">{agentFieldHelp.teamsSummary}</FieldInfo>
                  </div>
                  {agentTeams.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {agentTeams.map((team) => (
                        <Badge key={team.id} variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => router.push(`/teams/${team.id}`)}>
                          <Users className="w-3 h-3 mr-1" />
                          {team.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">Nao esta em nenhum time</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mission Tab */}
        <TabsContent value="mission" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Objetivo" infoAriaLabel="Ajuda sobre o objetivo do agente">
                {agentFieldHelp.missionObjective}
              </CardTitleWithInfo>
              <CardDescription>Defina o proposito principal deste agente</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={missionGoal}
                onChange={(e) => setMissionGoal(e.target.value)}
                placeholder="Ex: Garantir que todas as solicitacoes sejam atendidas de forma eficiente..."
                rows={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Responsabilidades" infoAriaLabel="Ajuda sobre responsabilidades do agente">
                {agentFieldHelp.missionResponsibilities}
              </CardTitleWithInfo>
              <CardDescription>Liste as principais responsabilidades do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {responsibilities.map((resp, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <Input
                    value={resp}
                    onChange={(e) =>
                      setResponsibilities((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setResponsibilities((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setResponsibilities((prev) => [...prev, ""])}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar responsabilidade
              </Button>
            </CardContent>
          </Card>

          {isAdvancedMode && (
            <Card>
              <CardHeader>
                <CardTitleWithInfo title="Instrucao de Sistema" infoAriaLabel="Ajuda sobre instrução de sistema">
                  {agentFieldHelp.systemInstruction}
                </CardTitleWithInfo>
                <CardDescription>Prompt base que define o comportamento do agente</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  placeholder="Voce e um assistente..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}

          {isAdvancedMode && (
            <Card>
              <CardHeader>
                <CardTitleWithInfo title="Modelo LLM (override)" infoAriaLabel="Ajuda sobre modelo de runtime">
                  <p>
                    Opcional: quando vazio, herda o modelo efetivo do workflow/workspace. Quando selecionado, salva um
                    override apenas para este agente (coordenador ou especialista).
                  </p>
                </CardTitleWithInfo>
                <CardDescription>
                  Opcoes listadas respeitam os modelos habilitados em{" "}
                  <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                    Configuracoes &gt; Integracoes
                  </Link>
                  . Em OpenRouter, a lista pode incluir IDs <code className="text-xs">provider/model</code>, inclusive
                  modelos de imagem permitidos no workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 max-w-lg">
                <div className="space-y-2">
                <Label htmlFor="agent-openai-model">Modelo LLM/chat</Label>
                <Select value={openaiRuntimeModelPick} onValueChange={setOpenaiRuntimeModelPick}>
                  <SelectTrigger id="agent-openai-model">
                    <SelectValue placeholder="Escolher..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Herdar do workflow / workspace</SelectItem>
                    {chatModelsForAgentSelect.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-image-model">Modelo de imagem</Label>
                  <Select value={imageGenerationModelPick} onValueChange={setImageGenerationModelPick}>
                    <SelectTrigger id="agent-image-model">
                      <SelectValue placeholder="Escolher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">Herdar imagem do workflow / workspace</SelectItem>
                      {imageModelsForAgentSelect.map((m) => (
                        <SelectItem key={`image-${m}`} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Usado pela tool <code className="text-xs">image_generation</code> quando ela envia{" "}
                    <code className="text-xs">model: default</code>. Não altera o modelo de chat do agente.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Fontes de Conhecimento" infoAriaLabel="Ajuda sobre fontes de conhecimento">
                {agentFieldHelp.knowledgeSources}
              </CardTitleWithInfo>
              <CardDescription>Selecione as bases de conhecimento que o agente pode acessar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {knowledgeSources.map((source) => {
                const Icon = knowledgeTypeIcons[source.type] || Database
                const isActive = knowledgeSourceIds.includes(source.id)
                return (
                  <div
                    key={source.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isActive ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">{source.description}</p>
                        {source.itemCount && (
                          <p className="text-xs text-muted-foreground mt-1">{source.itemCount} itens</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setKnowledgeSourceIds((prev) => [...prev, source.id])
                          return
                        }
                        setKnowledgeSourceIds((prev) => prev.filter((id) => id !== source.id))
                      }}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuracao de Memoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium">Memoria de Sessao</p>
                    <FieldInfo ariaLabel="Ajuda sobre memória de sessão">{agentFieldHelp.sessionMemory}</FieldInfo>
                  </div>
                  <p className="text-sm text-muted-foreground">Lembra do contexto durante a conversa</p>
                </div>
                <Switch checked={useSessionMemory} onCheckedChange={setUseSessionMemory} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium">Memoria Persistente</p>
                    <FieldInfo ariaLabel="Ajuda sobre memória persistente">{agentFieldHelp.persistentMemory}</FieldInfo>
                  </div>
                  <p className="text-sm text-muted-foreground">Lembra de informacoes entre sessoes</p>
                </div>
                <Switch checked={usePersistentMemory} onCheckedChange={setUsePersistentMemory} />
              </div>
              {isAdvancedMode && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1">
                      <Label>Contexto Fixo</Label>
                      <FieldInfo ariaLabel="Ajuda sobre contexto fixo">{agentFieldHelp.fixedContext}</FieldInfo>
                    </div>
                    <Textarea
                      value={fixedContext}
                      onChange={(e) => setFixedContext(e.target.value)}
                      placeholder="Informacoes que o agente sempre deve considerar..."
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vault" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Second-brain deste agente" infoAriaLabel="Ajuda sobre second-brain">
                <p>
                  Escopo local: notas de aprendizado indexadas para este agente (propostas, activas ou arquivadas).
                  Aprovação humana promove de proposta para activa. A listagem usa os mesmos endpoints que a Memória do
                  time em Configurações, com filtro por agente (e opcionalmente por cliente).
                </p>
              </CardTitleWithInfo>
              <CardDescription>
                {vaultPartyFilter.trim() ? (
                  <>
                    Vista filtrada por este agente e pelo cliente (party) seleccionado. Para rever ou aprovar em
                    contexto de workspace, abra{" "}
                    <Link
                      href={buildWorkspaceSecondBrainHref({
                        vaultAgent: id,
                        vaultParty: vaultPartyFilter.trim(),
                      })}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Configurações → Workspace → Memória do time
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Vista filtrada por <code className="text-xs">agentId</code> deste registo.{" "}
                    <Link
                      href={buildWorkspaceSecondBrainHref({ vaultAgent: id })}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Memória do time (workspace)
                    </Link>{" "}
                    mostra o mesmo vault com filtros de time, agente e cliente.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cliente (party)</Label>
                  <Select
                    value={vaultPartyFilter.trim() ? vaultPartyFilter : "__all__"}
                    onValueChange={(v) => setVaultPartyFilter(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="w-[min(100%,280px)]">
                      <SelectValue placeholder="Todos por agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos (por agente)</SelectItem>
                      {partyOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.displayName || p.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshVaultNotes()}
                  disabled={!api || vaultLoading}
                >
                  {vaultLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Atualizar lista
                </Button>
              </div>
              {vaultNotes.length === 0 && !vaultLoading ? (
                <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-4">
                  {(() => {
                    const empty =
                      vaultNotesLoadError === "forbidden"
                        ? vaultNotesEmptyCopy("agent", "forbidden")
                        : vaultNotesLoadError === "network"
                          ? vaultNotesEmptyCopy("agent", "network")
                          : vaultNotesEmptyCopy("agent", "empty_after_load", {
                              hasPartyFilter: Boolean(vaultPartyFilter.trim()),
                            })
                    return (
                      <>
                        <p className="text-sm font-medium text-foreground">{empty.title}</p>
                        {empty.lines.map((line, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {line}
                          </p>
                        ))}
                        <Button type="button" variant="secondary" size="sm" asChild>
                          <Link
                            href={buildWorkspaceSecondBrainHref({
                              vaultAgent: id,
                              ...(vaultPartyFilter.trim() ? { vaultParty: vaultPartyFilter.trim() } : {}),
                            })}
                          >
                            Abrir Memória do time (mesmos filtros)
                          </Link>
                        </Button>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {vaultNotes.map((r) => (
                    <div
                      key={r.noteId}
                      ref={(el) => {
                        vaultNoteRefs.current[r.noteId] = el
                      }}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium line-clamp-1">{r.title || r.noteId}</span>
                        <Badge variant="outline">{r.status}</Badge>
                        <Badge variant="secondary">{r.kind}</Badge>
                      </div>
                      {r.bodyPreview ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{r.bodyPreview}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {api ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                const res = await api.get<{
                                  body: string
                                  contentHash: string
                                }>(`/vault/notes/${r.noteId}`)
                                const rawBody = res.data.body.trimStart()
                                const lines = rawBody.split(/\r?\n/)
                                let title = r.title
                                let innerBody = rawBody
                                if (lines[0]?.startsWith("# ")) {
                                  title = lines[0].slice(2).trim()
                                  innerBody = lines.slice(1).join("\n").replace(/^\s+/, "")
                                }
                                setVaultEditDraft({
                                  noteId: r.noteId,
                                  title,
                                  body: innerBody,
                                  contentHash: res.data.contentHash,
                                })
                                setVaultEditOpen(true)
                              } catch (e) {
                                toast.error(e instanceof ApiError ? e.message : "Falha ao abrir nota")
                              }
                            }}
                          >
                            Editar
                          </Button>
                        ) : null}
                        {r.status === "proposed" && api ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await api.put(`/vault/notes/${r.noteId}/approve`, undefined, {
                                    ifMatch: r.contentHash,
                                  })
                                  toast.success("Nota aprovada")
                                  await refreshVaultNotes()
                                } catch (e) {
                                  toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar")
                                }
                              }}
                            >
                              Aprovar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await api.put(`/vault/notes/${r.noteId}/reject`, undefined, {
                                    ifMatch: r.contentHash,
                                  })
                                  toast.success("Nota rejeitada")
                                  await refreshVaultNotes()
                                } catch (e) {
                                  toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar")
                                }
                              }}
                            >
                              Rejeitar
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={vaultEditOpen} onOpenChange={setVaultEditOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar nota no vault</DialogTitle>
                <DialogDescription>
                  Gravar envia If-Match com o hash actual. Se outro utilizador gravou entretanto, recarregue a lista.
                </DialogDescription>
              </DialogHeader>
              {vaultEditDraft ? (
                <div className="space-y-3">
                  <div>
                    <Label>Titulo</Label>
                    <Input
                      value={vaultEditDraft.title}
                      onChange={(e) => setVaultEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Corpo</Label>
                    <Textarea
                      value={vaultEditDraft.body}
                      onChange={(e) => setVaultEditDraft((d) => (d ? { ...d, body: e.target.value } : d))}
                      className="mt-1 min-h-[140px] font-mono text-xs"
                    />
                  </div>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setVaultEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!vaultEditDraft || !api || vaultEditBusy}
                  onClick={async () => {
                    if (!api || !vaultEditDraft) return
                    setVaultEditBusy(true)
                    try {
                      await api.put(
                        `/vault/notes/${vaultEditDraft.noteId}`,
                        { title: vaultEditDraft.title.trim(), body: vaultEditDraft.body },
                        { ifMatch: vaultEditDraft.contentHash },
                      )
                      toast.success("Nota gravada")
                      setVaultEditOpen(false)
                      setVaultEditDraft(null)
                      await refreshVaultNotes()
                    } catch (e) {
                      if (e instanceof ApiError && e.status === 412) {
                        toast.error("Conflito: a nota mudou no servidor. Recarregue a lista e tente outra vez.")
                      } else {
                        toast.error(e instanceof ApiError ? e.message : "Falha ao gravar")
                      }
                    } finally {
                      setVaultEditBusy(false)
                    }
                  }}
                >
                  {vaultEditBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Domínios habilitados" infoAriaLabel="Ajuda sobre domínios de negócio">
                Habilite CRM, Clinical, Finance e outros domínios. O backend resolve dependências e ativa as actions
                internas correspondentes automaticamente.
              </CardTitleWithInfo>
              <CardDescription>
                As tools concretas ficam visíveis abaixo apenas para auditoria e ajuste avançado.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {businessDomains.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum domínio de negócio disponível.</p>
              ) : (
                businessDomains.map((domain) => {
                  const ids = domain.availableActionIds ?? domain.actionIds
                  const enabledCount = ids.filter((actionId) => {
                    const def = workspaceToolDefs.find(
                      (toolDef) =>
                        toolDef.kind === "internal_action" &&
                        toolDef.enabled &&
                        toolDef.config?.actionId === actionId &&
                        customToolDefinitionIds.includes(toolDef.id),
                    )
                    return Boolean(def)
                  }).length
                  const fullyEnabled = ids.length > 0 && enabledCount === ids.length
                  return (
                    <div key={domain.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{domain.label}</p>
                            {fullyEnabled ? <Badge variant="secondary">habilitado</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{domain.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={fullyEnabled ? "outline" : "default"}
                          disabled={readOnly || domainBusy === domain.id}
                          onClick={() => enableDomainForAgent(domain.id)}
                        >
                          {fullyEnabled ? "Reaplicar" : "Habilitar"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{ids.length} actions</Badge>
                        {(domain.dependsOnDomainIds ?? []).map((dep) => (
                          <Badge key={dep} variant="outline">depende de {dep}</Badge>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Ferramentas do catalogo" infoAriaLabel="Ajuda sobre ferramentas do catálogo">
                {agentFieldHelp.catalogTools}
              </CardTitleWithInfo>
              <CardDescription>
                So aparecem ferramentas com integracao configurada no workspace (runtime real, nao stub).{" "}
                <Link
                  href="/settings?tab=integrations"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Configuracoes → Integracoes
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {operationalCatalogTools.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Nenhuma ferramenta de catalogo disponivel</AlertTitle>
                  <AlertDescription>
                    Configure Postgres (consulta SQL), CRM ou Calendario nas integracoes do workspace para
                    ativar toggles aqui.
                  </AlertDescription>
                </Alert>
              ) : (
                operationalCatalogTools.map((tool) => {
                  const isEnabled = enabledTools.includes(tool.id)
                  return (
                    <div
                      key={tool.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        isEnabled ? "border-accent bg-accent/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isEnabled ? "bg-accent/10" : "bg-muted"}`}>
                          <Wrench className={`w-5 h-5 ${isEnabled ? "text-accent" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        disabled={readOnly}
                        onCheckedChange={(checked) => {
                          if (readOnly) return
                          if (checked) {
                            setEnabledTools((prev) => [...prev, tool.id])
                            return
                          }
                          setEnabledTools((prev) => prev.filter((tid) => tid !== tool.id))
                        }}
                      />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Ferramentas do workspace" infoAriaLabel="Ajuda sobre ferramentas do workspace">
                {agentFieldHelp.workspaceTools}
              </CardTitleWithInfo>
              <CardDescription>
                Definicoes personalizadas (`http_webhook`, `builtin_ref`, `internal_action`) criadas em{" "}
                <Link href="/tool-definitions" className="text-primary underline-offset-4 hover:underline">
                  Tools
                </Link>
                . Apenas itens ativos aparecem aqui.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <Select value={workspaceToolFilterKind} onValueChange={setWorkspaceToolFilterKind}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tipo: todos</SelectItem>
                    <SelectItem value="coordination">coordination</SelectItem>
                    <SelectItem value="composite_workflow">composite_workflow</SelectItem>
                    <SelectItem value="primitive">primitive</SelectItem>
                    <SelectItem value="read_model">read_model</SelectItem>
                    <SelectItem value="admin_diagnostic">admin_diagnostic</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workspaceToolFilterDomain} onValueChange={setWorkspaceToolFilterDomain}>
                  <SelectTrigger><SelectValue placeholder="Domínio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Domínio: todos</SelectItem>
                    {workspaceToolDomainOptions.map((domain) => (
                      <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={workspaceToolFilterRisk} onValueChange={setWorkspaceToolFilterRisk}>
                  <SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Risco: todos</SelectItem>
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workspaceToolFilterExposure} onValueChange={setWorkspaceToolFilterExposure}>
                  <SelectTrigger><SelectValue placeholder="Exposição" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Exposição: todas</SelectItem>
                    <SelectItem value="primary">primary</SelectItem>
                    <SelectItem value="advanced">advanced</SelectItem>
                    <SelectItem value="hidden">hidden</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workspaceToolFilterOwner} onValueChange={setWorkspaceToolFilterOwner}>
                  <SelectTrigger><SelectValue placeholder="Dono recomendado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Dono: todos</SelectItem>
                    {workspaceToolOwnerOptions.map((owner) => (
                      <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inactiveWorkspaceToolDefs.length > 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Existem tools desativadas no workspace</AlertTitle>
                  <AlertDescription>
                    {inactiveWorkspaceToolDefs.length} item(ns) estao ocultos desta lista porque `enabled=false`.
                    Reative em{" "}
                    <Link href="/tool-definitions" className="text-primary underline-offset-4 hover:underline">
                      Tools
                    </Link>{" "}
                    para voltarem a aparecer aqui.
                  </AlertDescription>
                </Alert>
              ) : null}
              {filteredWorkspaceToolDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tool ativa encontrada com os filtros atuais.
                </p>
              ) : (
                filteredWorkspaceToolDefs.map((def) => {
                  const checked = customToolDefinitionIds.includes(def.id)
                  const extraConfig = describeWorkspaceToolConfig(def, businessActionCatalogById)
                  const internalMeta =
                    def.kind === "internal_action" && typeof def.config?.actionId === "string"
                      ? businessActionCatalogById[def.config.actionId]
                      : undefined
                  return (
                    <div
                      key={def.id}
                      className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${
                        checked ? "border-accent bg-accent/5" : "border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">
                            {def.kind === "internal_action" && internalMeta?.title
                              ? internalMeta.title
                              : def.name}
                          </p>
                          <Badge variant="outline">{def.kind}</Badge>
                          {internalMeta?.packId ? (
                            <Badge variant="outline" className="text-xs">
                              {internalMeta.packId}
                            </Badge>
                          ) : null}
                          {internalMeta?.toolKind ? (
                            <Badge variant="outline" className="text-xs">
                              {internalMeta.toolKind}
                            </Badge>
                          ) : null}
                          {internalMeta?.riskLevel ? (
                            <Badge
                              variant={internalMeta.riskLevel === "high" ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              risco:{internalMeta.riskLevel}
                            </Badge>
                          ) : null}
                          {internalMeta?.uiExposureMode ? (
                            <Badge variant="outline" className="text-xs">
                              {internalMeta.uiExposureMode}
                            </Badge>
                          ) : null}
                          {checked ? <Badge variant="secondary">Habilitada neste agente</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{def.slug}</p>
                        {extraConfig ? <p className="text-xs text-muted-foreground mt-1 break-all">{extraConfig}</p> : null}
                        {internalMeta?.riskLevel === "high" && agent.role !== "coordinator" ? (
                          <p className="text-xs text-amber-600 mt-1">
                            Atenção: tool de alto risco para este papel; prefira workflow composto no modo padrão.
                          </p>
                        ) : null}
                        {internalMeta?.toolKind === "primitive" && internalMeta?.riskLevel === "high" ? (
                          <p className="text-xs text-amber-700 mt-1">
                            Substituição recomendada:{" "}
                            {(typeof def.config?.actionId === "string"
                              ? primitiveReplacementByActionId[def.config.actionId]
                              : []
                            )?.join(", ") || "use um workflow composto equivalente."}
                          </p>
                        ) : null}
                      </div>
                      <Switch
                        checked={checked}
                        disabled={readOnly}
                        onCheckedChange={(on) => {
                          if (on) {
                            setCustomToolDefinitionIds((prev) =>
                              prev.includes(def.id) ? prev : [...prev, def.id],
                            )
                            return
                          }
                          setCustomToolDefinitionIds((prev) => prev.filter((x) => x !== def.id))
                        }}
                      />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCPs Tab */}
        <TabsContent value="mcps" className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <h3 className="text-lg font-semibold">Conexoes MCP</h3>
                <FieldInfo ariaLabel="Ajuda sobre conexões MCP">{agentFieldHelp.mcpSection}</FieldInfo>
              </div>
              <p className="text-sm text-muted-foreground">Vincule integracs externas ao agente</p>
            </div>
            <Dialog open={isMCPBindingOpen} onOpenChange={setIsMCPBindingOpen}>
              <DialogTrigger asChild>
                <Button disabled={readOnly}>
                  <Plus className="w-4 h-4 mr-2" />
                  Vincular MCP
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Vincular MCP ao Agente</DialogTitle>
                  <DialogDescription>
                    Selecione uma conexao MCP e as ferramentas permitidas
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label>Selecionar MCP</Label>
                      <FieldInfo ariaLabel="Ajuda sobre seleção de MCP">{agentFieldHelp.mcpDialogSelect}</FieldInfo>
                    </div>
                    <Select value={selectedMCP || ""} onValueChange={setSelectedMCP}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma conexao" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMCPsForBinding.map((mcp) => (
                          <SelectItem key={mcp.id} value={mcp.id}>
                            {mcp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedMCPData && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label>Ferramentas Permitidas</Label>
                          <FieldInfo ariaLabel="Ajuda sobre ferramentas MCP permitidas">
                            {agentFieldHelp.mcpDialogTools}
                          </FieldInfo>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedMCPData.tools.map((tool) => (
                            <div key={tool.name} className="flex items-center space-x-2">
                              <Checkbox
                                id={tool.name}
                                checked={selectedTools.includes(tool.name)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTools([...selectedTools, tool.name])
                                  } else {
                                    setSelectedTools(selectedTools.filter((t) => t !== tool.name))
                                  }
                                }}
                              />
                              <div className="flex-1">
                                <label htmlFor={tool.name} className="text-sm font-medium cursor-pointer">
                                  {tool.name}
                                </label>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-sm">Requer aprovacao</p>
                            <FieldInfo ariaLabel="Ajuda sobre aprovação no vínculo MCP">
                              {agentFieldHelp.mcpDialogApproval}
                            </FieldInfo>
                          </div>
                          <p className="text-xs text-muted-foreground">Acoes precisam de aprovacao manual</p>
                        </div>
                        <Switch
                          checked={bindingRequiresApproval}
                          onCheckedChange={setBindingRequiresApproval}
                        />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsMCPBindingOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddMCPBinding} disabled={!selectedMCP || selectedTools.length === 0}>
                    Vincular
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bindings.map((binding) => {
              const mcp = mcps.find((m) => m.id === binding.mcpConnectionId)
              if (!mcp) return null
              return (
                <Card key={binding.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Plug className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{mcp.name}</CardTitle>
                          <Badge
                            variant={mcp.status === "connected" ? "default" : "secondary"}
                            className="mt-1"
                          >
                            {mcp.status === "connected" ? "Conectado" : "Desconectado"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={readOnly}
                        onClick={() => handleRemoveBinding(binding.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{mcp.description}</p>
                    <div className="space-y-2">
                      <Label className="text-xs">Ferramentas permitidas:</Label>
                      <div className="flex flex-wrap gap-1">
                        {binding.allowedTools.map((tool) => (
                          <Badge key={tool} variant="outline" className="text-xs">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {binding.requiresApproval && (
                      <div className="flex items-center gap-2 mt-3 text-warning">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">Requer aprovacao</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {bindings.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Plug className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhum MCP vinculado</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Vincule conexoes MCP para expandir as capacidades do agente
                </p>
                <Button disabled={readOnly} onClick={() => setIsMCPBindingOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Vincular primeiro MCP
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Nivel de Acesso" infoAriaLabel="Ajuda sobre nível de acesso">
                {agentFieldHelp.securityAccessLevel}
              </CardTitleWithInfo>
              <CardDescription>Defina as permissoes de acesso do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="security-access-level">Nivel de acesso a dados</Label>
                <Select
                  value={securityAccessLevel}
                  onValueChange={(v) => setSecurityAccessLevel(v as "read" | "write" | "restricted")}
                >
                  <SelectTrigger id="security-access-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Leitura - Apenas consulta dados</SelectItem>
                    <SelectItem value="write">Escrita - Pode modificar dados</SelectItem>
                    <SelectItem value="restricted">Restrito - Acesso limitado a dados sensiveis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleWithInfo title="Aprovacoes" infoAriaLabel="Ajuda sobre aprovações">
                {agentFieldHelp.securityApproval}
              </CardTitleWithInfo>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">Requer aprovacao para acoes</p>
                  <p className="text-sm text-muted-foreground">
                    Acoes criticas precisam de aprovacao manual
                  </p>
                </div>
                <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
              </div>
            </CardContent>
          </Card>

          {isAdvancedMode && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitleWithInfo
                  title="Zona de Perigo"
                  infoAriaLabel="Ajuda sobre arquivar ou excluir agente"
                  className="text-destructive"
                >
                  {agentFieldHelp.dangerZone}
                </CardTitleWithInfo>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Arquivar agente</p>
                    <p className="text-sm text-muted-foreground">O agente sera desativado mas mantido no historico</p>
                  </div>
                  <Button variant="outline">Arquivar</Button>
                </div>
                {agent.origin === "company" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-destructive">Excluir agente</p>
                        <p className="text-sm text-muted-foreground">Esta acao nao pode ser desfeita</p>
                      </div>
                      <Button variant="destructive">Excluir</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        </fieldset>
      </Tabs>
    </div>
  )
}
