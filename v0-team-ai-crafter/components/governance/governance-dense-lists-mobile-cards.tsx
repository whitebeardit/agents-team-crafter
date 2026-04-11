"use client"

import type { GovernanceAuditEvent, GovernanceTeamSloRow } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function sloStatusBadge(row: GovernanceTeamSloRow) {
  if (row.meetsSlo == null) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  if (row.meetsSlo) {
    return (
      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        Dentro
      </Badge>
    )
  }
  return <Badge variant="destructive">Fora</Badge>
}

type GovernanceTeamSlosMobileCardsProps = {
  teams: GovernanceTeamSloRow[]
}

/**
 * Vista em cartões para SLO por time (Loop 74). Paridade com a tabela em md+.
 */
export function GovernanceTeamSlosMobileCards({ teams }: GovernanceTeamSlosMobileCardsProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0 md:hidden" aria-label="SLO por time (vista em cartões)">
      {teams.map((row) => (
        <li
          key={row.teamId}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-snug text-foreground pr-2">{row.teamName}</h3>
            {sloStatusBadge(row)}
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">OK</dt>
                <dd className="text-right tabular-nums">{row.completed}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Falha</dt>
                <dd className="text-right tabular-nums">{row.failed}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Taxa</dt>
              <dd className="tabular-nums">
                {row.successRate == null ? "—" : `${(row.successRate * 100).toFixed(1)}%`}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">p50</dt>
                <dd className="text-muted-foreground text-sm tabular-nums">
                  {formatLatencyMs(row.latencyMsPercentiles?.p50Ms)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">p95</dt>
                <dd className="text-muted-foreground text-sm tabular-nums">
                  {formatLatencyMs(row.latencyMsPercentiles?.p95Ms)}
                </dd>
              </div>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

function formatEventType(t: string) {
  return t.replace(/^governance\./, "").replace(/_/g, " ")
}

type GovernanceTimelineMobileCardsProps = {
  events: GovernanceAuditEvent[]
}

/**
 * Linha do tempo — resumo (Loop 74).
 */
export function GovernanceTimelineMobileCards({ events }: GovernanceTimelineMobileCardsProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0 md:hidden" aria-label="Linha do tempo (vista em cartões)">
      {events.map((ev) => (
        <li key={ev.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="font-mono text-xs max-w-[min(100%,18rem)] break-all text-left">
              {formatEventType(ev.eventType)}
            </Badge>
            <time
              className="text-xs text-muted-foreground tabular-nums shrink-0"
              dateTime={ev.createdAt}
            >
              {ev.createdAt ? new Date(ev.createdAt).toLocaleString("pt-BR") : "—"}
            </time>
          </div>
          {Object.keys(ev.payload ?? {}).length > 0 && (
            <p className="mt-2 break-all text-xs text-muted-foreground">{JSON.stringify(ev.payload)}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

type GovernanceAuditFullMobileCardsProps = {
  events: GovernanceAuditEvent[]
}

/**
 * Auditoria completa — página atual (Loop 74). Paginação permanece fora deste componente.
 */
export function GovernanceAuditFullMobileCards({ events }: GovernanceAuditFullMobileCardsProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0 md:hidden" aria-label="Auditoria completa (vista em cartões)">
      {events.map((ev) => (
        <li key={ev.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Badge variant="secondary" className="max-w-full break-all font-mono text-xs">
              {ev.eventType}
            </Badge>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={ev.createdAt}
            >
              {ev.createdAt ? new Date(ev.createdAt).toLocaleString("pt-BR") : "—"}
            </time>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{JSON.stringify(ev.payload)}</p>
        </li>
      ))}
    </ul>
  )
}
