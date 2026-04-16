"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Copy, Download, FileStack, Info, Share2 } from "lucide-react"
import { TemplateCard } from "@/components/templates/template-card"
import type { AgentOrigin, Channel, Template } from "@/lib/types"
import { toast } from "sonner"
import { createApiClient } from "@/lib/api/client"
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
import { Checkbox } from "@/components/ui/checkbox"
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

type TemplateApplyDetail = Template & {
  agents?: Array<{ id?: string; name?: string; role?: string }>
}

type TemplateApplyResponse = {
  teamId: string
  name: string
  status: string
  message: string
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
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [applyDetail, setApplyDetail] = useState<TemplateApplyDetail | null>(null)
  const [applyDetailLoading, setApplyDetailLoading] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const [templatesRes, channelsRes] = await Promise.all([
        api.get<Template[]>("/templates"),
        api.get<Channel[]>("/channels"),
      ])
      setCatalogTemplates(templatesRes.data)
      setChannels(channelsRes.data)
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
    setSelectedChannelIds([])
  }

  const handleImport = (template: Template) => {
    setSelectedTemplate(template)
    setTeamName(`${template.name} - Novo Time`)
    setTeamDescription(template.description || "")
    setSelectedChannelIds([])
  }

  const handleShare = (template: Template) => {
    toast.info(`Compartilhamento de "${template.name}" em breve!`)
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !teamName.trim() || !token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setIsApplying(true)
    try {
      const res = await api.post<TemplateApplyResponse>(`/templates/${selectedTemplate.id}/apply`, {
        teamName: teamName.trim(),
        teamDescription: teamDescription.trim() || undefined,
        channelIds: selectedChannelIds,
      })
      const teamId = res.data.teamId
      toast.success("Template aplicado — a abrir o time na consola de teste.")
      resetApplyModal()
      router.push(`/teams/${teamId}?tab=debug`)
    } catch {
      toast.error("Falha ao aplicar template")
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
            Catalogo alinhado ao seed: cada modelo indica quantos agentes referencia e os requisitos antes de aplicar.
          </p>
        </div>
        <ContextualTourManualTrigger screenKey="templates_catalog" />
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

      {/* Catálogo: cartões (TemplateCard) vs tabela — Loop 76 */}
      {filteredTemplates.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onImport={handleImport}
                onShare={handleShare}
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
                    <TableHead className="whitespace-nowrap">v / Categoria</TableHead>
                    <TableHead className="text-right">Agentes</TableHead>
                    <TableHead className="min-w-[160px]">Descrição</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
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
                          {template.origin === "company" ? (
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileStack className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Nenhum template encontrado
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Templates aparecerão aqui quando disponíveis
          </p>
        </div>
      )}

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
                <p className="text-xs text-muted-foreground pt-1">
                  O servidor associa por nome; o coordenador efectivo segue a regra do backend (primeiro coordenador
                  do workspace).
                </p>
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
            <div className="space-y-2">
              <Label>Canais iniciais (opcional)</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {channels.map((channel) => (
                  <label key={channel.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedChannelIds.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedChannelIds((prev) => [...prev, channel.id])
                          return
                        }
                        setSelectedChannelIds((prev) => prev.filter((id) => id !== channel.id))
                      }}
                    />
                    <span>{channel.name}</span>
                  </label>
                ))}
                {channels.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>
                )}
              </div>
            </div>
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
    </div>
  )
}
