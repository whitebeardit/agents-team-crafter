"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type {
  Agent,
  AgentMCPBinding,
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
import { toast } from "sonner"
import {
  ArrowLeft,
  Crown,
  Target,
  Brain,
  Wrench,
  Plug,
  Radio,
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
  ExternalLink,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { normalizeAgentCategory } from "@/lib/utils/agent-category"

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  api: "API",
}

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

export default function AgentDetailsPage({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
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
  const [customToolDefinitionIds, setCustomToolDefinitionIds] = useState<string[]>([])
  const [workspaceToolDefs, setWorkspaceToolDefs] = useState<
    Array<{ id: string; name: string; slug: string; enabled: boolean }>
  >([])
  const [enabledChannels, setEnabledChannels] = useState<Array<"whatsapp" | "slack" | "email" | "api">>([])
  const [canReplyDirectly, setCanReplyDirectly] = useState(true)
  const [securityAccessLevel, setSecurityAccessLevel] = useState<"read" | "write" | "restricted">("read")
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [workspaceOpenAiConfigured, setWorkspaceOpenAiConfigured] = useState<boolean | null>(null)
  const [operationalCatalogTools, setOperationalCatalogTools] = useState<OperationalCatalogTool[]>([])

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
        (a.capabilities?.tools ?? []).filter((id) => options.operationalCatalogToolIds!.has(id)),
      )
    } else {
      setEnabledTools(a.capabilities?.tools ?? [])
    }
    setCustomToolDefinitionIds(a.capabilities?.customToolDefinitionIds ?? [])
    setEnabledChannels((a.channelConfig?.enabled ?? a.channels) as Array<"whatsapp" | "slack" | "email" | "api">)
    setCanReplyDirectly(a.channelConfig?.canReplyDirectly ?? true)
    setSecurityAccessLevel((a.security?.accessLevel ?? "read") as "read" | "write" | "restricted")
    setRequiresApproval(a.security?.requiresApproval ?? false)
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
        const [a, m, b, ks, t, td, int] = await Promise.all([
          api.get<Agent>(`/agents/${id}`),
          api.get<MCPConnection[]>("/mcps"),
          api.get<AgentMCPBinding[]>(`/agents/${id}/mcp-bindings`),
          api.get<KnowledgeSource[]>("/knowledge-sources"),
          api.get<Team[]>(`/teams?page=1&perPage=100`),
          api
            .get<Array<{ id: string; name: string; slug: string; enabled: boolean }>>("/tool-definitions")
            .catch(() => ({ data: [], meta: {} })),
          api
            .get<{
              secretsMasked: { openaiApiKeyConfigured: boolean }
              operationalCatalogTools: OperationalCatalogTool[]
            }>("/settings/workspace/integrations")
            .catch(() => ({
              data: {
                secretsMasked: { openaiApiKeyConfigured: false },
                operationalCatalogTools: [] as OperationalCatalogTool[],
              },
              meta: {},
            })),
        ])
        const opTools = int.data.operationalCatalogTools ?? []
        setOperationalCatalogTools(opTools)
        const opIds = new Set(opTools.map((x) => x.id))
        applyAgentPayload(a.data, { operationalCatalogToolIds: opIds })
        setWorkspaceOpenAiConfigured(int.data.secretsMasked.openaiApiKeyConfigured)
        setMcps(m.data)
        setBindings(b.data)
        setKnowledgeSources(ks.data)
        setTeams(t.data)
        setWorkspaceToolDefs(td.data.filter((x) => x.enabled))
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

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Agente nao encontrado</p>
      </div>
    )
  }

  const readOnly = agent.origin === "whitebeard"
  const channelsLockedForRole = agent.role === "specialist"

  const boundMCPIds = bindings.map((b) => b.mcpConnectionId)
  const availableMCPsForBinding = mcps.filter(
    (m) => !boundMCPIds.includes(m.id) && m.status === "connected",
  )
  
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
              customToolDefinitionIds,
            }),
        },
        ...(agent.role === "coordinator"
          ? [
              {
                label: "Canais",
                run: () =>
                  api.put(`/agents/${agent.id}/channels`, {
                    enabled: enabledChannels,
                    canReplyDirectly,
                  }),
              },
            ]
          : []),
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
      const [fresh, intFresh] = await Promise.all([
        api.get<Agent>(`/agents/${id}`),
        api.get<{
          secretsMasked: { openaiApiKeyConfigured: boolean }
          operationalCatalogTools: OperationalCatalogTool[]
        }>("/settings/workspace/integrations"),
      ])
      const opTools = intFresh.data.operationalCatalogTools ?? []
      setOperationalCatalogTools(opTools)
      const opIds = new Set(opTools.map((x) => x.id))
      applyAgentPayload(fresh.data, { operationalCatalogToolIds: opIds })
      setWorkspaceOpenAiConfigured(intFresh.data.secretsMasked.openaiApiKeyConfigured)
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
      {workspaceOpenAiConfigured === false && agent.origin === "company" ? (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Chave OpenAI do workspace</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90 flex flex-col sm:flex-row sm:items-center gap-3">
            <span>
              Nao ha chave OpenAI (BYOK) neste workspace. O runtime dos agentes precisa dela em producao
              multi-tenant, ou de <code className="text-xs bg-background/50 px-1 rounded">OPENAI_API_KEY</code>{" "}
              no servidor (apenas demo local).
            </span>
            <Button asChild variant="secondary" size="sm" className="w-fit shrink-0">
              <Link href="/settings?tab=integrations">Configurar integracoes</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="advanced-mode" className="text-sm text-muted-foreground">
              Modo avancado
            </Label>
            <Switch
              id="advanced-mode"
              checked={isAdvancedMode}
              onCheckedChange={setIsAdvancedMode}
              disabled={readOnly}
            />
          </div>
          <Button onClick={handleSave} disabled={saving || readOnly}>
            {readOnly ? "Somente leitura" : saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <AgentWhitebeardIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Visao Geral</span>
          </TabsTrigger>
          <TabsTrigger value="mission" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Missao</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Conhecimento</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Ferramentas</span>
          </TabsTrigger>
          <TabsTrigger value="mcps" className="flex items-center gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">MCPs</span>
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Radio className="w-4 h-4" />
            <span className="hidden sm:inline">Canais</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Seguranca</span>
          </TabsTrigger>
        </TabsList>

        <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0 space-y-6">

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informacoes Basicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="agent-description" className="text-muted-foreground">
                    Descricao
                  </Label>
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
                    <Label className="text-muted-foreground">Funcao</Label>
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
                    <Label htmlFor="agent-category" className="text-muted-foreground">
                      Categoria
                    </Label>
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
                  <Label htmlFor="agent-skills" className="text-muted-foreground">
                    Skills (separadas por virgula)
                  </Label>
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
                <CardTitle>Resumo de Configuracao</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                      <p className="text-xs text-muted-foreground">Ferramentas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Brain className="w-5 h-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium">{agent.knowledge?.sources?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Fontes de Conhecimento</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Radio className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">{agent.channelConfig?.enabled?.length || agent.channels.length}</p>
                      <p className="text-xs text-muted-foreground">Canais Ativos</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Times</Label>
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
              <CardTitle>Objetivo</CardTitle>
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
              <CardTitle>Responsabilidades</CardTitle>
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
                <CardTitle>Instrucao de Sistema</CardTitle>
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
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fontes de Conhecimento</CardTitle>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Memoria de Sessao</p>
                  <p className="text-sm text-muted-foreground">Lembra do contexto durante a conversa</p>
                </div>
                <Switch checked={useSessionMemory} onCheckedChange={setUseSessionMemory} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Memoria Persistente</p>
                  <p className="text-sm text-muted-foreground">Lembra de informacoes entre sessoes</p>
                </div>
                <Switch checked={usePersistentMemory} onCheckedChange={setUsePersistentMemory} />
              </div>
              {isAdvancedMode && (
                <>
                  <Separator />
                  <div>
                    <Label>Contexto Fixo</Label>
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

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas do catalogo</CardTitle>
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
              <CardTitle>Ferramentas do workspace</CardTitle>
              <CardDescription>
                Definicoes personalizadas (webhook HTTP, builtin_ref) criadas em{" "}
                <Link href="/tool-definitions" className="text-primary underline-offset-4 hover:underline">
                  Tools
                </Link>
                . Apenas itens ativos aparecem aqui.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceToolDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tool de workspace ativa. Crie em Tools ou ative uma existente.
                </p>
              ) : (
                workspaceToolDefs.map((def) => {
                  const checked = customToolDefinitionIds.includes(def.id)
                  return (
                    <div
                      key={def.id}
                      className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${
                        checked ? "border-accent bg-accent/5" : "border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{def.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{def.slug}</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Conexoes MCP</h3>
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
                    <Label>Selecionar MCP</Label>
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
                        <Label>Ferramentas Permitidas</Label>
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

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm">Requer aprovacao</p>
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

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-6">
          {channelsLockedForRole && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Canais apenas para coordenadores</AlertTitle>
              <AlertDescription>
                Apenas agentes com função <strong>Coordenador</strong> podem ter canais configurados. Este agente
                é especialista; entrada e saída externas ficam a cargo do coordenador do time.
              </AlertDescription>
            </Alert>
          )}
          {!channelsLockedForRole && agent.role === "coordinator" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Tipos de canal (aqui) vs. canais no grafo do time</AlertTitle>
              <AlertDescription>
                As opções abaixo são <strong>tipos</strong> de canal em que o coordenador pode atuar (capacidade do
                agente). Já os <strong>nós de canal</strong> no editor de grafo vêm dos canais do workspace
                associados ao time na ficha do time (tab Canais, campo <code className="text-xs">channelIds</code>
                ). Os dois conceitos complementam-se: sem canais no time, o grafo não mostra ligações externas mesmo
                com tipos ligados aqui.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Canais Habilitados</CardTitle>
              <CardDescription>Defina em quais canais o agente pode atuar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["whatsapp", "slack", "email", "api"] as const).map((channel) => {
                const isEnabled = enabledChannels.includes(channel)
                return (
                  <div
                    key={channel}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isEnabled ? "border-success bg-success/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isEnabled ? "bg-success/10" : "bg-muted"}`}>
                        <Radio className={`w-5 h-5 ${isEnabled ? "text-success" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-medium">{channelLabels[channel]}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      disabled={readOnly || channelsLockedForRole}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEnabledChannels((prev) => [...prev, channel])
                          return
                        }
                        setEnabledChannels((prev) => prev.filter((id) => id !== channel))
                      }}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comportamento de Resposta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pode responder diretamente</p>
                  <p className="text-sm text-muted-foreground">
                    Se desabilitado, respostas sao apenas via coordenador
                  </p>
                </div>
                <Switch
                  checked={canReplyDirectly}
                  onCheckedChange={setCanReplyDirectly}
                  disabled={readOnly || channelsLockedForRole}
                />
              </div>
            </CardContent>
          </Card>

          {!channelsLockedForRole && agent.role === "coordinator" && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Chat SDK (Slack, Discord, Telegram, …)
                  <a
                    href="https://chat-sdk.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm font-normal"
                  >
                    Docs <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardTitle>
                <CardDescription>
                  Webhooks públicos disparam o <strong>coordenador</strong> do time ativo cujo{" "}
                  <code className="text-xs">channelIds</code> inclui esse canal. Slack roteia por{" "}
                  <code className="text-xs">config.slackTeamId</code>; Discord, Telegram e outras plataformas usam o
                  ID do documento do canal na URL do webhook.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Configure na página <strong>Canais</strong> (<code className="text-xs">provider: chat_sdk</code>,{" "}
                  <code className="text-xs">platform</code>) e segredos com admin (
                  <code className="text-xs">PUT /channels/:id/secrets</code>) — requer{" "}
                  <code className="text-xs">ENCRYPTION_MASTER_KEY</code> no servidor.
                </p>
                <p>
                  Exemplos:{" "}
                  <code className="text-xs break-all">
                    POST /api/v1/webhooks/chat/&lt;workspaceId&gt;/slack
                  </code>{" "}
                  ou{" "}
                  <code className="text-xs break-all">
                    POST …/webhooks/chat/&lt;workspaceId&gt;/discord|telegram/…/&lt;channelId&gt;
                  </code>
                  .
                </p>
                <p className="text-xs">
                  Chaves, <code className="text-xs">setWebhook</code> (Telegram) e portal Discord:{" "}
                  <code className="bg-muted px-1 rounded">docs/CHAT_SDK_TEAM_TRIGGER.md</code>.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nivel de Acesso</CardTitle>
              <CardDescription>Defina as permissoes de acesso do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nivel de acesso a dados</Label>
                <Select value={securityAccessLevel} onValueChange={(v) => setSecurityAccessLevel(v as "read" | "write" | "restricted")}>
                  <SelectTrigger>
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
              <CardTitle>Aprovacoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
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
                <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
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
