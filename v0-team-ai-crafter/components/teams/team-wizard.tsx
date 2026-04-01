"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { createApiClient } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  MessageSquare,
  Mail,
  Hash,
  Globe,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { toast } from "sonner"
import type { Agent, Channel, ChannelType, Team } from "@/lib/types"
import { formatCategoryLabel } from "@/lib/utils/agent-category"

const steps = [
  { id: 1, name: "Dados Básicos", description: "Nome e objetivo do time" },
  { id: 2, name: "Coordenador", description: "Selecione o agente coordenador" },
  { id: 3, name: "Especialistas", description: "Adicione agentes especialistas" },
  { id: 4, name: "Comunicação", description: "Configure conexões (opcional)" },
  { id: 5, name: "Revisão", description: "Confirme e publique" },
]

const channelOptions: { value: ChannelType; label: string; icon: React.ElementType }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "slack", label: "Slack", icon: Hash },
  { value: "email", label: "Email", icon: Mail },
  { value: "api", label: "API", icon: Globe },
]

export function TeamWizard() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [workspaceChannels, setWorkspaceChannels] = useState<Channel[]>([])
  const { token, refreshToken, currentWorkspace, wizardData, wizardStep, setWizardStep, updateWizardData, resetWizard } =
    useWorkspaceStore()

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
    void (async () => {
      try {
        const res = await api.get<Agent[]>("/agents?page=1&perPage=100")
        setAgents(res.data)
      } catch {
        toast.error("Falha ao carregar agentes")
      }
    })()
  }, [api])

  useEffect(() => {
    if (!api || wizardStep < 4) return
    void (async () => {
      try {
        const res = await api.get<Channel[]>("/channels")
        setWorkspaceChannels(res.data)
      } catch {
        toast.error("Falha ao carregar canais do workspace")
      }
    })()
  }, [api, wizardStep])

  const coordinators = agents.filter((a) => a.role === "coordinator")
  const specialists = agents.filter((a) => a.role === "specialist")

  const canProceed = () => {
    switch (wizardStep) {
      case 1:
        return wizardData.name.trim() !== "" && wizardData.objective.trim() !== ""
      case 2:
        return wizardData.coordinatorId !== null
      case 3:
        return true // Specialists are optional
      case 4:
        return true // Communication config is optional
      case 5:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (wizardStep < 5) {
      setWizardStep(wizardStep + 1)
    }
  }

  const handleBack = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1)
    }
  }

  const handlePublish = async () => {
    if (!api || !wizardData.coordinatorId) return
    setIsSubmitting(true)
    try {
      const res = await api.post<Team>("/teams", {
        name: wizardData.name,
        description: wizardData.description || wizardData.objective || "",
        objective: wizardData.objective || undefined,
        coordinatorId: wizardData.coordinatorId,
        agentIds: wizardData.specialistIds,
        channelIds: wizardData.channelIds,
        primaryChannel: wizardData.primaryChannel || undefined,
      })
      toast.success("Time criado com sucesso")
      resetWizard()
      router.push(`/teams/${res.data.id}`)
    } catch {
      toast.error("Falha ao criar time")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetWizard()
    router.push("/teams")
  }

  const selectedCoordinator = agents.find(
    (a) => a.id === wizardData.coordinatorId
  )
  const selectedSpecialists = agents.filter((a) =>
    wizardData.specialistIds.includes(a.id)
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
          Quer montar o time com ajuda da IA?{" "}
          <Link href="/teams/ai-create" className="font-medium text-primary underline-offset-4 hover:underline">
            Abrir Whitebeard AI Builder
          </Link>
        </div>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    wizardStep > step.id
                      ? "bg-primary text-primary-foreground"
                      : wizardStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {wizardStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="mt-2 text-center hidden md:block">
                  <p
                    className={`text-xs font-medium ${
                      wizardStep >= step.id
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.name}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-full h-0.5 mx-2 ${
                    wizardStep > step.id ? "bg-primary" : "bg-secondary"
                  }`}
                  style={{ minWidth: "2rem" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>{steps[wizardStep - 1].name}</CardTitle>
          <CardDescription>{steps[wizardStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info */}
          {wizardStep === 1 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome do Time</FieldLabel>
                <Input
                  id="name"
                  placeholder="Ex: Atendimento WhatsApp"
                  value={wizardData.name}
                  onChange={(e) => updateWizardData({ name: e.target.value })}
                  className="bg-secondary border-border"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="objective">Objetivo</FieldLabel>
                <Textarea
                  id="objective"
                  placeholder="Descreva o objetivo principal deste time..."
                  value={wizardData.objective}
                  onChange={(e) => updateWizardData({ objective: e.target.value })}
                  className="bg-secondary border-border min-h-24"
                />
              </Field>
              <Field>
                <FieldLabel>Canal Principal (opcional)</FieldLabel>
                <RadioGroup
                  value={wizardData.primaryChannel || ""}
                  onValueChange={(v) =>
                    updateWizardData({ primaryChannel: v as ChannelType })
                  }
                  className="grid grid-cols-2 gap-4 mt-2"
                >
                  {channelOptions.map((channel) => (
                    <Label
                      key={channel.value}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        wizardData.primaryChannel === channel.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-secondary/50 hover:bg-secondary"
                      }`}
                    >
                      <RadioGroupItem value={channel.value} className="sr-only" />
                      <channel.icon className="w-5 h-5 text-muted-foreground" />
                      <span>{channel.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </Field>
            </FieldGroup>
          )}

          {/* Step 2: Coordinator */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O coordenador gerencia o fluxo de trabalho e distribui tarefas entre os especialistas. Só
                agentes com função <strong>Coordenador</strong> podem ser escolhidos — são a porta de comunicação
                externa do time.
              </p>
              {coordinators.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6 text-center space-y-3">
                  <Crown className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum coordenador na empresa. Crie um agente com função Coordenador no catálogo antes de
                    montar o time.
                  </p>
                  <Button asChild variant="default">
                    <Link href="/agents">Criar coordenador</Link>
                  </Button>
                </div>
              ) : (
                <RadioGroup
                  value={wizardData.coordinatorId || ""}
                  onValueChange={(v) => updateWizardData({ coordinatorId: v })}
                  className="space-y-3"
                >
                  {coordinators.map((agent) => (
                    <Label
                      key={agent.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        wizardData.coordinatorId === agent.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-secondary/50 hover:bg-secondary"
                      }`}
                    >
                      <RadioGroupItem value={agent.id} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-warning" />
                          <span className="font-medium">{agent.name}</span>
                          <Badge variant="outline" className="text-xs">
                            v{agent.version}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Step 3: Specialists */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione os agentes especialistas que farão parte do time.
              </p>
              <div className="space-y-3">
                {specialists.map((agent) => (
                  <Label
                    key={agent.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      wizardData.specialistIds.includes(agent.id)
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/50 hover:bg-secondary"
                    }`}
                  >
                    <Checkbox
                      checked={wizardData.specialistIds.includes(agent.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateWizardData({
                            specialistIds: [...wizardData.specialistIds, agent.id],
                          })
                        } else {
                          updateWizardData({
                            specialistIds: wizardData.specialistIds.filter(
                              (id) => id !== agent.id
                            ),
                          })
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AgentWhitebeardIcon className="w-4 h-4 text-accent" />
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatCategoryLabel(agent.category)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {agent.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Communication — canais do workspace no time (channelIds) */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione quais <strong>canais do workspace</strong> entram na composição deste time. Eles aparecem no
                editor de grafo ligados ao coordenador. Isto é independente dos &quot;tipos&quot; de canal na ficha do
                agente coordenador.
              </p>
              {workspaceChannels.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-border bg-secondary/30 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum canal no workspace.{" "}
                    <Link href="/channels" className="text-primary underline-offset-4 hover:underline">
                      Criar canais
                    </Link>{" "}
                    antes de associar ao time, ou avance e configure depois na ficha do time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workspaceChannels.map((ch) => (
                    <Label
                      key={ch.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        wizardData.channelIds.includes(ch.id)
                          ? "border-success bg-success/5"
                          : "border-border bg-secondary/50 hover:bg-secondary"
                      }`}
                    >
                      <Checkbox
                        checked={wizardData.channelIds.includes(ch.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateWizardData({ channelIds: [...wizardData.channelIds, ch.id] })
                          } else {
                            updateWizardData({
                              channelIds: wizardData.channelIds.filter((cid) => cid !== ch.id),
                            })
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium">{ch.name}</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {channelOptions.find((c) => c.value === ch.type)?.label ?? ch.type}
                        </p>
                      </div>
                    </Label>
                  ))}
                </div>
              )}
              <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
                Handoff e layout visual entre agentes pode ser ajustado no Editor de Grafo após criar o time.
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {wizardStep === 5 && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Informações Básicas
                </h4>
                <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                  <p>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    <span className="font-medium">{wizardData.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Objetivo:</span>{" "}
                    {wizardData.objective}
                  </p>
                  {wizardData.primaryChannel && (
                    <p>
                      <span className="text-muted-foreground">Canal Principal:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {channelOptions.find((c) => c.value === wizardData.primaryChannel)?.label}
                      </Badge>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Canais no time:</span>{" "}
                    <span className="font-medium">{wizardData.channelIds.length}</span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-sm space-y-2">
                <p className="font-medium text-foreground">Antes de publicar (recomendado)</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>
                    <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                      Configurar chave OpenAI
                    </Link>{" "}
                    do workspace (BYOK) para o runtime dos agentes.
                  </li>
                  <li>
                    Se usar Slack ou e-mail, complete{" "}
                    <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                      Integracoes
                    </Link>{" "}
                    ou os segredos em <strong>Canais</strong>.
                  </li>
                </ul>
              </div>

              <Separator />

              {/* Coordinator */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Coordenador
                </h4>
                {selectedCoordinator && (
                  <div className="p-4 rounded-lg bg-secondary/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedCoordinator.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCategoryLabel(selectedCoordinator.category)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Specialists */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Especialistas ({selectedSpecialists.length})
                </h4>
                {selectedSpecialists.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSpecialists.map((agent) => (
                      <div
                        key={agent.id}
                        className="p-3 rounded-lg bg-secondary/50 flex items-center gap-3"
                      >
                        <AgentWhitebeardIcon className="w-5 h-5 text-accent" />
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCategoryLabel(agent.category)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum especialista selecionado
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={handleCancel}>
          Cancelar
        </Button>
        <div className="flex items-center gap-3">
          {wizardStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          {wizardStep < 5 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={isSubmitting || !canProceed()}>
              <Check className="w-4 h-4 mr-2" />
              {isSubmitting ? "Criando..." : "Criar Time"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
