"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState, type ComponentType } from "react"
import {
  Users,
  Radio,
  FileStack,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle,
  Gavel,
  History,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { GovernanceOpsSummary } from "@/lib/types"

type Metrics = {
  activeTeams: number
  availableAgents: number
  connectedChannels: number
  templates: number
  conversationsToday: number
  conversationsGrowth: number
  avgResponseTime: string
  satisfactionRate: number
}

type RecentTeam = {
  id: string
  name: string
  status: "active" | "draft" | "inactive"
  lastActivity: string
  agentCount: number
  conversationsToday: number
}

type DashboardAlert = {
  id: string
  type: "warning" | "info" | "error" | string
  title: string
  message: string
  actionUrl: string
  createdAt: string
}

type IconComponent = ComponentType<{ className?: string }>

const quickActions: {
  title: string
  description: string
  href: string
  icon: IconComponent
}[] = [
  {
    title: "Criar Time",
    description: "Configure um novo time de agentes",
    href: "/teams/create",
    icon: Plus,
  },
  {
    title: "Explorar Agentes",
    description: "Veja o catálogo de agentes disponíveis",
    href: "/agents",
    icon: AgentWhitebeardIcon,
  },
  {
    title: "Configurar Canais",
    description: "Conecte seus canais de comunicação",
    href: "/channels",
    icon: Radio,
  },
]

const statusColors = {
  active: "bg-success/10 text-success border-success/20",
  draft: "bg-warning/10 text-warning border-warning/20",
  inactive: "bg-muted text-muted-foreground border-muted",
}

const statusLabels = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
}

export default function DashboardPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentTeams, setRecentTeams] = useState<RecentTeam[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [govOps, setGovOps] = useState<GovernanceOpsSummary | null>(null)
  const [govOpsLoaded, setGovOpsLoaded] = useState(false)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const [m, rt, a, g] = await Promise.all([
        api.get<Metrics>("/dashboard/metrics"),
        api.get<RecentTeam[]>("/dashboard/recent-teams"),
        api.get<DashboardAlert[]>("/dashboard/alerts"),
        api.get<GovernanceOpsSummary>("/governance/ops-summary").catch(() => null),
      ])
      setMetrics(m.data)
      setRecentTeams(rt.data.slice(0, 3))
      setAlerts(a.data)
      setGovOps(g?.data ?? null)
      setGovOpsLoaded(true)
    })()
  }, [token, refreshToken, currentWorkspace])

  const metricCards: {
    title: string
    value: number
    icon: IconComponent
    color: string
    bgColor: string
  }[] = [
    {
      title: "Times Ativos",
      value: metrics?.activeTeams ?? 0,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Agentes Disponíveis",
      value: metrics?.availableAgents ?? 0,
      icon: AgentWhitebeardIcon,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Canais Conectados",
      value: metrics?.connectedChannels ?? 0,
      icon: Radio,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Templates",
      value: metrics?.templates ?? 0,
      icon: FileStack,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral dos seus times de agentes de IA
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <Card key={metric.title} className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`w-6 h-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Governança (resumo) */}
      <Card className="border-border bg-card border-primary/20">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              Governança
            </CardTitle>
            <CardDescription>
              Execuções, overlap e auditoria do workspace
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/runs">
              <Button size="sm" variant="outline" className="gap-1">
                <History className="w-4 h-4" />
                Execuções
              </Button>
            </Link>
            <Link href="/governance">
              <Button size="sm" variant="secondary" className="gap-1">
                Abrir painel
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!govOpsLoaded ? (
            <p className="text-sm text-muted-foreground">Carregando resumo de governança…</p>
          ) : govOps ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Runs com falha</p>
                <p className="text-2xl font-semibold tabular-nums">{govOps.runsFailedTotal}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Runs com sucesso</p>
                <p className="text-2xl font-semibold tabular-nums">{govOps.runsCompletedTotal}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Em execução</p>
                <p className="text-2xl font-semibold tabular-nums">{govOps.runsRunningTotal}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Taxa falha (30d)</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {govOps.runsFailureRateLast30d == null
                    ? "—"
                    : `${(govOps.runsFailureRateLast30d * 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Auditoria (30d)</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {govOps.governanceAuditEventsLast30d}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Reviews bloqueados (30d)</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {govOps.overlapReviewsBlockedLast30d}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Resumo de governança indisponível.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions & Recent Teams */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            <CardDescription>Comece rapidamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href}>
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{action.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent Teams */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Times Recentes</CardTitle>
              <CardDescription>Seus times criados recentemente</CardDescription>
            </div>
            <Link href="/teams">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum time neste workspace ainda.
                </p>
              ) : (
                recentTeams.map((team) => {
                  const st = team.status as keyof typeof statusLabels
                  return (
                    <Link key={team.id} href={`/teams/${team.id}`}>
                      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">
                              {team.name}
                            </p>
                            <Badge
                              variant="outline"
                              className={statusColors[st] ?? statusColors.inactive}
                            >
                              {statusLabels[st] ?? team.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Última atividade:{" "}
                            {new Date(team.lastActivity).toLocaleString("pt-BR")}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <AgentWhitebeardIcon className="w-3 h-3" />
                              {team.agentCount} agentes
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {team.conversationsToday} conversas hoje
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts / Pending Tasks */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Pendências
          </CardTitle>
          <CardDescription>Itens que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const isWarning = alert.type === "warning"
              const isError = alert.type === "error"
              const iconClass = isWarning ? "text-warning" : isError ? "text-destructive" : "text-primary"
              const boxClass = isWarning
                ? "bg-warning/5 border-warning/20"
                : isError
                ? "bg-destructive/5 border-destructive/20"
                : "bg-primary/5 border-primary/20"
              return (
                <div key={alert.id} className={`flex items-center gap-4 p-3 rounded-lg border ${boxClass}`}>
                  <Clock className={`w-5 h-5 ${iconClass}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                  <Link href={alert.actionUrl}>
                    <Button variant="outline" size="sm">
                      Ver
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
