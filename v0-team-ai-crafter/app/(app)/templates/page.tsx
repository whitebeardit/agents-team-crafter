"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronDown, Copy, Download, FileStack, Info, Pencil, Share2, Trash2, Upload } from "lucide-react"
import { TemplateCard } from "@/components/templates/template-card"
import type { AgentOrigin, Template, TemplateCredentialSlot } from "@/lib/types"
import { toast } from "sonner"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type TemplateApplyDetail = Template & {
  agents?: Array<{ id?: string; name?: string; role?: string }>
  templatePayload?: unknown
  credentialSlots?: TemplateCredentialSlot[]
}

type TemplateApplyResponse = {
  teamId: string
  name: string
  status: string
  message: string
  importWarnings?: string[]
  importMode?: string
}

const TEMPLATE_ORIGIN_LABELS: Record<AgentOrigin, string> = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

type GoldStarterRecommendation = {
  businessLabel: string
  description: string
  matcher: (template: Template) => boolean
}

function isWorkspaceCompanyTemplate(t: Template) {
  return t.origin === "company" && t.templateScope !== "global"
}

const GOLD_STARTER_RECOMMENDATIONS: GoldStarterRecommendation[] = [
  {
    businessLabel: "Clínica psicológica",
    description: "Operação com CRM + agenda + acompanhamento clínico.",
    matcher: (template) =>
      /clin|psy|care|clinical|crm|schedule/i.test(`${template.name} ${template.category} ${template.vertical ?? ""}`),
  },
  {
    businessLabel: "Clínica médica",
    description: "Atendimento clínico com agenda e registro operacional.",
    matcher: (template) => /medical|clin|clinical|schedule/i.test(`${template.name} ${template.category} ${template.vertical ?? ""}`),
  },
  {
    businessLabel: "Empresa de serviços",
    description: "Fluxo comercial e entrega com CRM + scheduling + financeiro.",
    matcher: (template) => /service|sales|crm|finance|schedule/i.test(`${template.name} ${template.category} ${template.vertical ?? ""}`),
  },
  {
    businessLabel: "Consultoria / operação comercial",
    description: "Captação de leads, agenda de reuniões e gestão de cobrança.",
    matcher: (template) => /consult|crm|finance|sales/i.test(`${template.name} ${template.category} ${template.vertical ?? ""}`),
  },
]

export default function TemplatesPage() {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [originFilter, setOriginFilter] = useState<AgentOrigin | "all">("all")
  const [catalogTemplates, setCatalogTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [applyDetail, setApplyDetail] = useState<TemplateApplyDetail | null>(null)
  const [applyDetailLoading, setApplyDetailLoading] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [channelSecretsJson, setChannelSecretsJson] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [importingFile, setImportingFile] = useState(false)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editVertical, setEditVertical] = useState("")
  const [editPrerequisitesText, setEditPrerequisitesText] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const editReplacePayloadRef = useRef<HTMLInputElement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [guidesOpen, setGuidesOpen] = useState(false)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const templatesRes = await api.get<Template[]>("/templates")
      setCatalogTemplates(templatesRes.data)
    })()
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (!token || !currentWorkspace || !selectedTemplate) {
      setApplyDetail(null)
      return
    }
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    let cancelled = false
    setApplyDetailLoading(true)
    setApplyDetail(null)
    void (async () => {
      try {
        const r = await api.get<TemplateApplyDetail>(`/templates/${selectedTemplate.id}`)
        if (!cancelled) setApplyDetail(r.data)
      } catch {
        if (!cancelled) setApplyDetail(null)
      } finally {
        if (!cancelled) setApplyDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, refreshToken, currentWorkspace, selectedTemplate])

  const filteredTemplates =
    originFilter === "all"
      ? catalogTemplates
      : catalogTemplates.filter((t) => t.origin === originFilter)

  const goldStarterTemplates = useMemo(
    () =>
      GOLD_STARTER_RECOMMENDATIONS.map((rec) => ({
        ...rec,
        template: catalogTemplates.find((tpl) => rec.matcher(tpl)) ?? null,
      })),
    [catalogTemplates],
  )

  const financeRecommendedTemplate = useMemo(
    () => catalogTemplates.find((tpl) => /finance|billing|invoice|cash|receivable|payable/i.test(`${tpl.name} ${tpl.category} ${tpl.vertical ?? ""}`)) ?? null,
    [catalogTemplates],
  )

  const clinicalRecommendedTemplate = useMemo(
    () => catalogTemplates.find((tpl) => /clinic|clinical|care|anamnese|prontuario|patient|consulta/i.test(`${tpl.name} ${tpl.category} ${tpl.vertical ?? ""}`)) ?? null,
    [catalogTemplates],
  )

  const servicesSalesRecommendedTemplate = useMemo(
    () => catalogTemplates.find((tpl) => /service|sales|proposal|catalog|package|encounter|pedido|venda|orcamento/i.test(`${tpl.name} ${tpl.category} ${tpl.vertical ?? ""}`)) ?? null,
    [catalogTemplates],
  )

  const careRemindersRecommendedTemplate = useMemo(
    () => catalogTemplates.find((tpl) => /care|reminder|follow|acompanhamento|lembrete|subject|paciente/i.test(`${tpl.name} ${tpl.category} ${tpl.vertical ?? ""}`)) ?? null,
    [catalogTemplates],
  )

  const platformOpsRecommendedTemplate = useMemo(
    () => catalogTemplates.find((tpl) => /github|platform|admin|ops|incident|deploy|issue|pull request|infra/i.test(`${tpl.name} ${tpl.category} ${tpl.vertical ?? ""}`)) ?? null,
    [catalogTemplates],
  )

  const financeStarterPrompts = [
    "Mostre o resumo financeiro da semana com entradas, saídas e saldo.",
    "Liste cobranças em atraso e proponha a sequência de follow-up.",
    "Registre o pagamento da fatura X e atualize o status no CRM.",
  ]

  const clinicalStarterPrompts = [
    "Resuma a história clínica recente do paciente X com sinais de atenção.",
    "Liste pendências clínicas de follow-up para hoje e próxima consulta.",
    "Organize um plano de acompanhamento por prioridade de risco.",
  ]

  const servicesSalesStarterPrompts = [
    "Mostre oportunidades abertas e próximos passos comerciais desta semana.",
    "Prepare proposta para o cliente X com pacote recomendado e preço-base.",
    "Converta a venda aprovada em atendimento/pacote e detalhe handoff operacional.",
  ]

  const careRemindersStarterPrompts = [
    "Liste sujeitos de cuidado com lembretes vencidos e priorize por risco.",
    "Monte agenda de lembretes de acompanhamento para os próximos 7 dias.",
    "Registre follow-up concluído do sujeito X e proponha próximo contato.",
  ]

  const platformOpsStarterPrompts = [
    "Liste incidentes críticos abertos e proponha plano de ação por prioridade.",
    "Resuma PRs/Issues bloqueadas e indique próximos responsáveis.",
    "Prepare checklist de deploy com riscos e validações obrigatórias.",
  ]

  const whitebeardCount = catalogTemplates.filter(
    (t) => t.origin === "whitebeard"
  ).length
  const companyCount = catalogTemplates.filter((t) => t.origin === "company").length

  const resetApplyModal = () => {
    setSelectedTemplate(null)
    setApplyDetail(null)
    setTeamName("")
    setTeamDescription("")
    setChannelSecretsJson("")
  }

  const handleImport = (template: Template) => {
    setSelectedTemplate(template)
    setTeamName(`${template.name} - Novo Time`)
    setTeamDescription(template.description || "")
    setChannelSecretsJson("")
  }

  const buildApi = useCallback(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  const handleImportTemplateFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      const nameDefault = file.name.replace(/\.json$/i, "") || "Template importado"
      const description = `Importado a partir de ${file.name}`
      const api = buildApi()
      if (!api) return
      setImportingFile(true)
      try {
        const text = await file.text()
        const payload = JSON.parse(text) as unknown
        await api.post("/templates/import", {
          name: nameDefault,
          description,
          category: "Geral",
          origin: "company",
          payload,
        })
        toast.success("Template adicionado ao catálogo")
        const templatesRes = await api.get<Template[]>("/templates")
        setCatalogTemplates(templatesRes.data)
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Falha ao importar JSON"
        toast.error(msg)
      } finally {
        setImportingFile(false)
      }
    },
    [buildApi],
  )

  const handleShare = (template: Template) => {
    toast.info(`Compartilhamento de "${template.name}" em breve!`)
  }

  const refreshCatalog = useCallback(async () => {
    const api = buildApi()
    if (!api) return
    const templatesRes = await api.get<Template[]>("/templates")
    setCatalogTemplates(templatesRes.data)
  }, [buildApi])

  const openEdit = (t: Template) => {
    setEditingTemplate(t)
    setEditName(t.name)
    setEditDescription(t.description ?? "")
    setEditCategory(t.category ?? "Geral")
    setEditVertical(t.vertical ?? "")
    setEditPrerequisitesText((t.prerequisites ?? []).join("\n"))
    if (editReplacePayloadRef.current) editReplacePayloadRef.current.value = ""
  }

  const closeEdit = () => {
    setEditingTemplate(null)
    if (editReplacePayloadRef.current) editReplacePayloadRef.current.value = ""
  }

  const handleSaveEdit = async () => {
    if (!editingTemplate || !editName.trim()) return
    const api = buildApi()
    if (!api) return
    setEditSaving(true)
    try {
      const pre = editPrerequisitesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
      const file = editReplacePayloadRef.current?.files?.[0]
      let templatePayload: unknown | undefined
      if (file) {
        const text = await file.text()
        templatePayload = JSON.parse(text) as unknown
      }
      await api.patch(`/templates/${editingTemplate.id}`, {
        name: editName.trim(),
        description: editDescription,
        category: editCategory.trim() || "Geral",
        vertical: editVertical.trim() || undefined,
        prerequisites: pre,
        ...(templatePayload !== undefined ? { templatePayload } : {}),
      })
      toast.success("Template atualizado")
      closeEdit()
      await refreshCatalog()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao guardar"
      toast.error(msg)
    } finally {
      setEditSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const api = buildApi()
    if (!api) return
    setDeleteLoading(true)
    try {
      await api.del(`/templates/${deleteTarget.id}`)
      toast.success("Template removido")
      setDeleteTarget(null)
      await refreshCatalog()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao apagar"
      toast.error(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !teamName.trim() || !token || !currentWorkspace) return
    const api = buildApi()
    if (!api) return
    let channelSecretPayloads: Record<string, unknown> | undefined
    if (channelSecretsJson.trim()) {
      try {
        const parsed = JSON.parse(channelSecretsJson) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          channelSecretPayloads = parsed as Record<string, unknown>
        } else {
          toast.error("Segredos: o JSON tem de ser um objecto (legacyId → corpo).")
          return
        }
      } catch {
        toast.error("Segredos: JSON inválido")
        return
      }
    }
    setIsApplying(true)
    try {
      const res = await api.post<TemplateApplyResponse>(`/templates/${selectedTemplate.id}/apply`, {
        teamName: teamName.trim(),
        teamDescription: teamDescription.trim() || undefined,
        channelSecretPayloads,
      })
      const data = res.data
      for (const w of data.importWarnings ?? []) {
        toast.message(w)
      }
      toast.success("Template aplicado — a abrir o time na consola de teste.")
      resetApplyModal()
      router.push(`/teams/${data.teamId}?tab=debug`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao aplicar template"
      toast.error(msg)
    } finally {
      setIsApplying(false)
    }
  }

  const copyGoldenPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Prompt copiado")
    } catch {
      toast.error("Não foi possível copiar")
    }
  }

  const loop137ValidationChecks = [
    {
      code: "finance_template",
      label: "Finance starter disponível",
      passed: Boolean(financeRecommendedTemplate),
      detail: financeRecommendedTemplate
        ? `Template financeiro encontrado: ${financeRecommendedTemplate.name}`
        : "Catálogo sem template financeiro explícito.",
    },
    {
      code: "clinical_template",
      label: "Clinical starter disponível",
      passed: Boolean(clinicalRecommendedTemplate),
      detail: clinicalRecommendedTemplate
        ? `Template clínico encontrado: ${clinicalRecommendedTemplate.name}`
        : "Catálogo sem template clínico explícito.",
    },
    {
      code: "sales_services_template",
      label: "Sales/Services starter disponível",
      passed: Boolean(servicesSalesRecommendedTemplate),
      detail: servicesSalesRecommendedTemplate
        ? `Template Sales/Services encontrado: ${servicesSalesRecommendedTemplate.name}`
        : "Catálogo sem template Sales/Services explícito.",
    },
    {
      code: "care_reminders_template",
      label: "Care/Reminders starter disponível",
      passed: Boolean(careRemindersRecommendedTemplate),
      detail: careRemindersRecommendedTemplate
        ? `Template Care/Reminders encontrado: ${careRemindersRecommendedTemplate.name}`
        : "Catálogo sem template Care/Reminders explícito.",
    },
    {
      code: "platform_ops_template",
      label: "Platform/Ops starter disponível",
      passed: Boolean(platformOpsRecommendedTemplate),
      detail: platformOpsRecommendedTemplate
        ? `Template Platform/Ops encontrado: ${platformOpsRecommendedTemplate.name}`
        : "Catálogo sem template Platform/Ops explícito.",
    },
  ]

  const loop137ValidationPassed = loop137ValidationChecks.every((check) => check.passed)

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="templates_catalog" />
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Catálogo com modelo completo (payload v2) ou legado. Aplicar cria um time novo. Importe JSON exportado de um time
            (<code className="text-xs">exportKind: team</code>) ou ficheiro de template (<code className="text-xs">template</code>) — o
            servidor sanitiza credenciais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportTemplateFile}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!token || !currentWorkspace || importingFile}
            onClick={() => importFileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {importingFile ? "A importar…" : "Importar JSON (time ou template)"}
          </Button>
          <ContextualTourManualTrigger screenKey="templates_catalog" />
        </div>
      </div>

      {/* Origin Tabs */}
      <Tabs
        value={originFilter}
        onValueChange={(v) => setOriginFilter(v as AgentOrigin | "all")}
      >
        <TabsList className="bg-secondary">
          <TabsTrigger value="all">
            Todos
            <Badge variant="secondary" className="ml-2">
              {catalogTemplates.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="whitebeard">
            Whitebeard
            <Badge variant="secondary" className="ml-2">
              {whitebeardCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="company">
            Meus Templates
            <Badge variant="secondary" className="ml-2">
              {companyCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Catálogo de templates</CardTitle>
          <CardDescription>
            Filtre por origem nas tabs. Modelos com <strong>payload completo</strong> aplicam import unificado; <strong>legado</strong>{" "}
            encaixa por nome. Em &quot;Minha Empresa&quot; pode editar metadados, substituir o JSON ou apagar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {filteredTemplates.length > 0 ? (
            <>
              <div className="grid gap-4 md:hidden">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onImport={handleImport}
                    onShare={handleShare}
                    showManageActions={isWorkspaceCompanyTemplate(template)}
                    onEdit={openEdit}
                    onDelete={(t) => setDeleteTarget(t)}
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <ResponsiveTableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead className="whitespace-nowrap">v / Categoria</TableHead>
                        <TableHead className="text-right">Agentes</TableHead>
                        <TableHead className="min-w-[160px]">Descrição</TableHead>
                        <TableHead className="w-[240px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div className="font-medium">{template.name}</div>
                            {template.vertical ? (
                              <div className="text-xs text-muted-foreground">Vertical: {template.vertical}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {TEMPLATE_ORIGIN_LABELS[template.origin]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={template.hasFullPayload ? "default" : "secondary"} className="text-xs">
                              {template.hasFullPayload ? "Completo" : "Legado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            v{template.version} · {template.category}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{template.agentCount}</TableCell>
                          <TableCell
                            className="max-w-[280px] truncate text-sm text-muted-foreground"
                            title={template.description}
                          >
                            {template.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleImport(template)}
                                className="gap-1"
                              >
                                <Download className="h-4 w-4 shrink-0" />
                                Usar
                              </Button>
                              {isWorkspaceCompanyTemplate(template) ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0"
                                    type="button"
                                    title="Editar"
                                    onClick={() => openEdit(template)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-destructive"
                                    type="button"
                                    title="Apagar"
                                    onClick={() => setDeleteTarget(template)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : template.origin === "company" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={() => handleShare(template)}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableScroll>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
              <FileStack className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-medium text-foreground">Nenhum template neste filtro</h3>
              <p className="mt-1 text-sm text-muted-foreground">Importe um JSON ou ajuste o filtro de origem.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={guidesOpen} onOpenChange={setGuidesOpen} className="rounded-lg border border-border">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex h-auto w-full items-center justify-between gap-2 px-4 py-3 font-medium"
          >
            <span className="text-left text-sm">
              Verticais GOLD, validação 131–137 e prompts sugeridos (opcional)
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${guidesOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-border px-4 pb-4 pt-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Starter Teams GOLD (Loop 130.8)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecione um tipo de negócio para começar com um template recomendado de alta qualidade e ajustar depois.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {goldStarterTemplates.map((starter) => (
              <div key={starter.businessLabel} className="rounded-md border bg-background p-3 space-y-2">
                <p className="text-sm font-medium">{starter.businessLabel}</p>
                <p className="text-xs text-muted-foreground">{starter.description}</p>
                {starter.template ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate" title={starter.template.name}>
                      Template: <strong>{starter.template.name}</strong>
                    </p>
                    <Button size="sm" variant="outline" onClick={() => handleImport(starter.template!)}>
                      Usar recomendado
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    Sem template recomendado neste workspace. Se for ambiente demo, execute o seed para publicar os starters GOLD.
                  </p>
                )}
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Finance agent-first GOLD (Loop 133)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Padrão de operação financeira: entrar no time com especialista financeiro, iniciar por prompt operacional e usar templates
            como starter team.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-3">
            <div className="space-y-2">
              {[
                "Abrir o time operacional da empresa e operar via especialista financeiro.",
                "Executar health/gate financeiro e priorizar pendências críticas.",
                "Aplicar prompts de cobrança/fluxo de caixa para a execução diária.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {financeStarterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left text-xs"
                  onClick={() => void copyGoldenPrompt(prompt)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {financeRecommendedTemplate ? (
                <Button size="sm" onClick={() => handleImport(financeRecommendedTemplate)}>
                  Usar starter team financeiro recomendado
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => router.push("/teams/create")}>
                  Criar time financeiro manualmente
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {financeRecommendedTemplate
                  ? `Template sugerido: ${financeRecommendedTemplate.name}`
                  : "Nenhum template financeiro detectado no catálogo atual."}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Clinical agent-first GOLD (Loop 134)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Padrão clínico agent-first: operar a jornada clínica por especialistas, com prompts orientados a histórico, risco e continuidade.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-3">
            <div className="space-y-2">
              {[
                "Entrar no time clínico e iniciar a operação via especialista clínico.",
                "Usar prompts para consolidar histórico clínico e pendências prioritárias.",
                "Executar acompanhamento e registrar desfechos no fluxo operacional do time.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {clinicalStarterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left text-xs"
                  onClick={() => void copyGoldenPrompt(prompt)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {clinicalRecommendedTemplate ? (
                <Button size="sm" onClick={() => handleImport(clinicalRecommendedTemplate)}>
                  Usar starter team clínico recomendado
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => router.push("/teams/create")}>
                  Criar time clínico manualmente
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {clinicalRecommendedTemplate
                  ? `Template sugerido: ${clinicalRecommendedTemplate.name}`
                  : "Nenhum template clínico detectado no catálogo atual."}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Services & Sales + Packages agent-first GOLD (Loop 135)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Padrão comercial/serviços agent-first: operar catálogo, venda, pacote e atendimento no mesmo fluxo via time especialista.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-3">
            <div className="space-y-2">
              {[
                "Iniciar no time comercial e acionar especialista de Sales/Services.",
                "Conduzir proposta e negociação com prompts operacionais objetivos.",
                "Concluir handoff para pacote/atendimento sem quebrar o fluxo do time.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {servicesSalesStarterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left text-xs"
                  onClick={() => void copyGoldenPrompt(prompt)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {servicesSalesRecommendedTemplate ? (
                <Button size="sm" onClick={() => handleImport(servicesSalesRecommendedTemplate)}>
                  Usar starter team Sales/Services recomendado
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => router.push("/teams/create")}>
                  Criar time Sales/Services manualmente
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {servicesSalesRecommendedTemplate
                  ? `Template sugerido: ${servicesSalesRecommendedTemplate.name}`
                  : "Nenhum template de Sales/Services detectado no catálogo atual."}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Care + Reminders agent-first GOLD (Loop 136)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Padrão de cuidado agent-first: operar sujeitos de cuidado e lembretes pelo time especialista, com continuidade de acompanhamento.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-3">
            <div className="space-y-2">
              {[
                "Entrar no time de cuidado e acionar especialista de care/reminders.",
                "Priorizar sujeitos de cuidado por risco e vencimento de lembretes.",
                "Executar follow-up e registrar próximos passos no mesmo fluxo de time.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {careRemindersStarterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left text-xs"
                  onClick={() => void copyGoldenPrompt(prompt)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {careRemindersRecommendedTemplate ? (
                <Button size="sm" onClick={() => handleImport(careRemindersRecommendedTemplate)}>
                  Usar starter team Care/Reminders recomendado
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => router.push("/teams/create")}>
                  Criar time Care/Reminders manualmente
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {careRemindersRecommendedTemplate
                  ? `Template sugerido: ${careRemindersRecommendedTemplate.name}`
                  : "Nenhum template de Care/Reminders detectado no catálogo atual."}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>GitHub Ops + Platform/Admin agent-first GOLD (Loop 137)</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Padrão de suporte operacional agent-first: times administrativos/plataforma operando incidentes, backlog e deploy com prompts guiados.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-3">
            <div className="space-y-2">
              {[
                "Entrar no time de operações e acionar especialista de plataforma/admin.",
                "Priorizar incidentes e bloqueios com prompts de triagem objetiva.",
                "Executar follow-up de PR/issue/deploy mantendo trilha operacional no time.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {platformOpsStarterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left text-xs"
                  onClick={() => void copyGoldenPrompt(prompt)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5 shrink-0" />
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {platformOpsRecommendedTemplate ? (
                <Button size="sm" onClick={() => handleImport(platformOpsRecommendedTemplate)}>
                  Usar starter team Platform/Ops recomendado
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => router.push("/teams/create")}>
                  Criar time Platform/Ops manualmente
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {platformOpsRecommendedTemplate
                  ? `Template sugerido: ${platformOpsRecommendedTemplate.name}`
                  : "Nenhum template de Platform/Ops detectado no catálogo atual."}
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Validação final da sequência 131–137</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checklist de validação do catálogo após implementação das verticais agent-first GOLD.
          </p>
          <div className="rounded-md border bg-background p-3 space-y-2">
            {loop137ValidationChecks.map((check) => (
              <div key={check.code} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{check.passed ? "✅" : "⚠️"} {check.label}</p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-xs">
            Status final:{" "}
            <strong className={loop137ValidationPassed ? "text-emerald-600" : "text-amber-600"}>
              {loop137ValidationPassed ? "VALIADO" : "PENDÊNCIAS NO CATÁLOGO"}
            </strong>
          </p>
        </AlertDescription>
      </Alert>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={Boolean(selectedTemplate)} onOpenChange={(open) => !open && resetApplyModal()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar template</DialogTitle>
            <DialogDescription>
              Crie um novo time a partir de <strong>{selectedTemplate?.name}</strong>. Leia os requisitos antes de
              confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {applyDetailLoading ? (
              <p className="text-sm text-muted-foreground">A carregar detalhes do template...</p>
            ) : null}

            {applyDetail?.prerequisites && applyDetail.prerequisites.length > 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Requisitos</AlertTitle>
                <AlertDescription asChild>
                  <ul className="list-disc pl-4 text-sm space-y-1 mt-2">
                    {applyDetail.prerequisites.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.applyBehavior ? (
              <Alert variant="default" className="border-muted">
                <AlertTitle className="text-sm">O que acontece ao aplicar</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {applyDetail.applyBehavior}
                </AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.validationSteps && applyDetail.validationSteps.length > 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Como validar após criar o time</AlertTitle>
                <AlertDescription asChild>
                  <ol className="list-decimal pl-4 text-sm space-y-1 mt-2">
                    {applyDetail.validationSteps.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                </AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.expectedOutcome ? (
              <Alert variant="default" className="border-border bg-muted/30">
                <AlertTitle className="text-sm">Comportamento esperado (cenário feliz)</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground mt-1">{applyDetail.expectedOutcome}</AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.goldenPrompts && applyDetail.goldenPrompts.length > 0 ? (
              <div className="rounded-md border border-border p-3 space-y-2">
                <p className="text-sm font-medium">Prompts de teste (consola Debug)</p>
                <p className="text-xs text-muted-foreground">
                  Copie para a consola do time após aplicar — são cenários dourados sugeridos, não garantias de produção.
                </p>
                <ul className="space-y-2">
                  {applyDetail.goldenPrompts.map((p, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between rounded-md bg-secondary/40 p-2 text-sm"
                    >
                      <span className="min-w-0 flex-1">{p}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={() => void copyGoldenPrompt(p)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {applyDetail?.agents && applyDetail.agents.length > 0 ? (
              <div className="rounded-md border border-border p-3 space-y-1">
                <p className="text-sm font-medium">Agentes referenciados no modelo</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {applyDetail.agents.map((a, i) => (
                    <li key={i}>
                      {a.name ?? "—"} {a.role ? <span className="text-foreground">({a.role})</span> : null}
                    </li>
                  ))}
                </ul>
                {applyDetail.hasFullPayload ? (
                  <p className="text-xs text-muted-foreground pt-1">
                    Este template tem payload completo: ao aplicar, cria-se um novo time com agentes e canais a partir
                    do ficheiro (import unificado), sem reutilizar agentes do workspace.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">
                    Modo legado: o servidor associa por nome; o coordenador efectivo segue a regra do backend
                    (primeiro coordenador do workspace).
                  </p>
                )}
              </div>
            ) : null}

            {applyDetail?.credentialSlots && applyDetail.credentialSlots.length > 0 ? (
              <div className="space-y-2">
                <Label>Segredos pendentes (canais)</Label>
                <p className="text-xs text-muted-foreground">
                  Ids: {applyDetail.credentialSlots.map((c) => c.legacyId).join(", ")}. Corpo: JSON (Chat SDK) por
                  `legacyId` chave, veja documentação.
                </p>
                <Textarea
                  value={channelSecretsJson}
                  onChange={(e) => setChannelSecretsJson(e.target.value)}
                  rows={5}
                  placeholder='{"<legacyId>": { "platform": "whatsapp", ... } }'
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="template-team-name">Nome do time</Label>
              <Input
                id="template-team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Nome do novo time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-team-description">Descricao (opcional)</Label>
              <Textarea
                id="template-team-description"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                rows={3}
              />
            </div>
            {(!applyDetail?.credentialSlots || applyDetail.credentialSlots.length === 0) && (
              <div className="space-y-2">
                <Label>Segredos opcionais (JSON avançado)</Label>
                <p className="text-xs text-muted-foreground">Objecto `legacyId` de canal (Chat SDK) se precisar de cifra ao aplicar.</p>
                <Textarea
                  value={channelSecretsJson}
                  onChange={(e) => setChannelSecretsJson(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                  placeholder="{}"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetApplyModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={isApplying || !teamName.trim() || applyDetailLoading}
            >
              {isApplying ? "Aplicando..." : "Aplicar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTemplate)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar template</DialogTitle>
            <DialogDescription>
              Metadados do catálogo. Opcionalmente escolha um ficheiro JSON (<code className="text-xs">team</code> ou{" "}
              <code className="text-xs">template</code>) para substituir o modelo guardado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-tpl-name">Nome</Label>
              <Input id="edit-tpl-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tpl-desc">Descrição</Label>
              <Textarea
                id="edit-tpl-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tpl-cat">Categoria</Label>
              <Input id="edit-tpl-cat" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tpl-vert">Vertical (opcional)</Label>
              <Input id="edit-tpl-vert" value={editVertical} onChange={(e) => setEditVertical(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tpl-pre">Requisitos (um por linha)</Label>
              <Textarea
                id="edit-tpl-pre"
                value={editPrerequisitesText}
                onChange={(e) => setEditPrerequisitesText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Substituir payload (opcional)</Label>
              <p className="text-xs text-muted-foreground">Só preencha se quiser trocar o JSON completo do template.</p>
              <input
                ref={editReplacePayloadRef}
                type="file"
                accept="application/json,.json"
                className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded file:border file:bg-secondary file:px-2 file:py-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEdit}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()} disabled={editSaving || !editName.trim()}>
              {editSaving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `O modelo «${deleteTarget.name}» será removido do catálogo deste workspace. Esta acção não pode ser anulada.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
