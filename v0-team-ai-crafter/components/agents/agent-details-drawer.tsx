"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Crown, Plus, Copy, Settings2, Plug, Brain, Radio, Wrench } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { toast } from "sonner"
import type { Agent, AgentMCPBinding } from "@/lib/types"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"

interface AgentDetailsDrawerProps {
  agent: Agent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToTeam?: (agent: Agent) => void
}

const originLabels = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  api: "API",
}

export function AgentDetailsDrawer({
  agent,
  open,
  onOpenChange,
  onAddToTeam,
}: AgentDetailsDrawerProps) {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [agentBindings, setAgentBindings] = useState<AgentMCPBinding[]>([])
  
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
    if (!api || !agent || !open) return
    void (async () => {
      try {
        const res = await api.get<AgentMCPBinding[]>(`/agents/${agent.id}/mcp-bindings`)
        setAgentBindings(res.data)
      } catch {
        setAgentBindings([])
        toast.error("Falha ao carregar vinculos MCP do agente")
      }
    })()
  }, [api, agent, open])

  if (!agent) return null

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const toolCount = agent.capabilities?.tools?.length || 0
  const knowledgeCount = agent.knowledge?.sources?.length || 0
  const channelCount = agent.channelConfig?.enabled?.length || agent.channels.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-4">
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
                <SheetTitle className="text-xl">{agent.name}</SheetTitle>
                {agent.role === "coordinator" && (
                  <Crown className="w-5 h-5 text-warning" />
                )}
              </div>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {originLabels[agent.origin]}
                </Badge>
                <span>v{agent.version}</span>
                <Badge
                  variant={agent.status === "active" ? "default" : agent.status === "draft" ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {agent.status === "active" ? "Ativo" : agent.status === "draft" ? "Rascunho" : "Arquivado"}
                </Badge>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              Descricao
            </h4>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>

          {/* Goal */}
          {agent.goal && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Objetivo
                </h4>
                <p className="text-sm text-muted-foreground">{agent.goal}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Indicators */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Configuracao
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Plug className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{agentBindings.length}</p>
                  <p className="text-xs text-muted-foreground">MCPs</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Wrench className="w-4 h-4 text-accent" />
                <div>
                  <p className="text-sm font-medium">{toolCount}</p>
                  <p className="text-xs text-muted-foreground">Ferramentas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Brain className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">{knowledgeCount}</p>
                  <p className="text-xs text-muted-foreground">Conhecimento</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Radio className="w-4 h-4 text-success" />
                <div>
                  <p className="text-sm font-medium">{channelCount}</p>
                  <p className="text-xs text-muted-foreground">Canais</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Role */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Funcao</h4>
            <Badge
              variant="secondary"
              className={
                agent.role === "coordinator"
                  ? "bg-primary/10 text-primary"
                  : "bg-accent/10 text-accent"
              }
            >
              {agent.role === "coordinator" ? "Coordenador" : "Especialista"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {agent.role === "coordinator"
                ? "Gerencia fluxos de trabalho e distribui tarefas entre especialistas."
                : "Executa tarefas especificas dentro do time de agentes."}
            </p>
          </div>

          <Separator />

          {/* Category */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              Categoria
            </h4>
            <Badge variant="outline">{agent.category}</Badge>
          </div>

          <Separator />

          {/* Skills */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Skills</h4>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Channels */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              Canais Compativeis
            </h4>
            <div className="flex flex-wrap gap-2">
              {agent.channels.map((channel) => (
                <Badge key={channel} variant="outline">
                  {channelLabels[channel]}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button onClick={() => onAddToTeam?.(agent)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar ao Time
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                onOpenChange(false)
                router.push(`/agents/${agent.id}`)
              }}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Configurar Agente
            </Button>
            {agent.origin === "whitebeard" && (
              <Button variant="outline" className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                Duplicar e Customizar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
