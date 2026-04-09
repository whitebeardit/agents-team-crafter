"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import type { AgentPlanDraft, GovernanceFeatureFlags } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function parseLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function AgentCreationWizard() {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [objective, setObjective] = useState("")
  const [context, setContext] = useState("")
  const [expectedOutcome, setExpectedOutcome] = useState("")
  const [category, setCategory] = useState("geral")
  const [skills, setSkills] = useState("")
  const [boundaries, setBoundaries] = useState("")
  const [exclusions, setExclusions] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [plan, setPlan] = useState<AgentPlanDraft | null>(null)
  const [overlapPolicy, setOverlapPolicy] = useState<GovernanceFeatureFlags["overlapMode"] | null>(null)

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (!api) return
    void api
      .get<GovernanceFeatureFlags>("/governance/feature-flags")
      .then((r) => setOverlapPolicy(r.data.overlapMode))
      .catch(() => setOverlapPolicy(null))
  }, [api])

  const generatePlan = async () => {
    if (!api || objective.trim().length < 10) return
    setLoading(true)
    try {
      const res = await api.post<AgentPlanDraft>("/agent-plans", {
        objective: objective.trim(),
        context: context.trim() || undefined,
        expectedOutcome: expectedOutcome.trim() || undefined,
        category: category.trim() || "geral",
        skills: parseCsv(skills),
        boundaries: parseLines(boundaries),
        exclusions: parseLines(exclusions),
      })
      setPlan(res.data)
      toast.success("Plano de agente criado")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao criar plano do agente"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const savePlan = async () => {
    if (!api || !plan) return
    setSaving(true)
    try {
      const res = await api.put<AgentPlanDraft>(`/agent-plans/${plan.id}`, {
        request: plan.request,
        draftAgent: plan.draftAgent,
      })
      setPlan(res.data)
      toast.success("Plano atualizado")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao salvar plano"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const executePlan = async () => {
    if (!api || !plan) return
    setExecuting(true)
    try {
      const res = await api.post<AgentPlanDraft>(`/agent-plans/${plan.id}/execute`)
      setPlan(res.data)
      if (res.data.result?.createdAgentId) {
        toast.success("Agente criado com sucesso")
        router.push("/agents")
        return
      }
      if (res.data.result?.reusedAgentId) {
        toast.success("O workspace já tinha um agente adequado; reuso recomendado")
        router.push(`/agents/${res.data.result.reusedAgentId}`)
        return
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao executar plano"
      toast.error(message)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1) Definir objetivo do agente</CardTitle>
          <CardDescription>
            O wizard cria um draft com fronteiras de domínio e checa overlap antes de persistir.
          </CardDescription>
          {overlapPolicy === "warning" && (
            <Alert className="mt-3 border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Modo aviso no workspace</AlertTitle>
              <AlertDescription>
                Criação pode prosseguir mesmo com overlap relevante; a resposta pode incluir aviso em{" "}
                <code className="text-xs">meta.governanceWarning</code> no envelope da API.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-objective">Objetivo</Label>
            <Textarea
              id="agent-objective"
              className="min-h-24"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: validar documentos fiscais de entrada sem assumir atendimento ao cliente."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-context">Contexto</Label>
            <Textarea
              id="agent-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Time alvo, restrições, dados de entrada, ferramentas relevantes..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-outcome">Resultado esperado</Label>
            <Input
              id="agent-outcome"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="Ex: devolver parecer estruturado com inconsistências e próximos passos."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-category">Categoria</Label>
              <Input id="agent-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-skills">Skills</Label>
              <Input
                id="agent-skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="analise fiscal, triagem, validacao"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-boundaries">Fronteiras do domínio</Label>
              <Textarea
                id="agent-boundaries"
                value={boundaries}
                onChange={(e) => setBoundaries(e.target.value)}
                placeholder={"Uma por linha\nValidar XML fiscal\nClassificar inconsistências"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-exclusions">Exclusões</Label>
              <Textarea
                id="agent-exclusions"
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder={"Uma por linha\nNão responder cliente final\nNão negociar SLA"}
              />
            </div>
          </div>
          <Button onClick={() => void generatePlan()} disabled={loading || objective.trim().length < 10}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {loading ? "Planejando..." : "Gerar plano do agente"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>2) Revisar draft e overlap</CardTitle>
            <CardDescription>
              Ajuste o draft antes de criar. O backend volta a validar overlap ao salvar e ao executar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.overlapReview && (
              <Alert variant={plan.decision === "blocked" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {plan.decision === "reuse_existing"
                    ? "Reuso recomendado"
                    : plan.decision === "blocked"
                      ? "Conflito de domínio"
                      : "Review de overlap"}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{plan.overlapReview.summary}</p>
                  {plan.overlapReview.matches.length > 0 && (
                    <div className="space-y-2">
                      {plan.overlapReview.matches.map((match) => (
                        <div key={match.agentId} className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{match.agentName}</span>
                            <Badge variant="outline">{match.classification}</Badge>
                            <Badge variant="secondary">score {match.score.toFixed(2)}</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{match.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome sugerido</Label>
                <Input
                  value={plan.draftAgent.name}
                  onChange={(e) =>
                    setPlan({
                      ...plan,
                      draftAgent: { ...plan.draftAgent, name: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={plan.draftAgent.category ?? ""}
                  onChange={(e) =>
                    setPlan({
                      ...plan,
                      draftAgent: { ...plan.draftAgent, category: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={plan.draftAgent.description ?? ""}
                onChange={(e) =>
                  setPlan({
                    ...plan,
                    draftAgent: { ...plan.draftAgent, description: e.target.value },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivo final</Label>
              <Textarea
                value={plan.draftAgent.goal ?? ""}
                onChange={(e) =>
                  setPlan({
                    ...plan,
                    draftAgent: { ...plan.draftAgent, goal: e.target.value },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Notas do planner</Label>
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
                {plan.notes.join(" ")}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void savePlan()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saving ? "Salvando..." : "Salvar ajustes"}
              </Button>
              <Button
                onClick={() => void executePlan()}
                disabled={executing || plan.decision === "blocked"}
              >
                {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {plan.decision === "reuse_existing"
                  ? "Confirmar reuso"
                  : executing
                    ? "Executando..."
                    : "Criar agente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
