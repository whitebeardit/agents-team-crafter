"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { TeamRunRecord } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function runStatusBadgeVariant(s: TeamRunRecord["status"]) {
  if (s === "failed") return "destructive" as const
  if (s === "running") return "secondary" as const
  return "outline" as const
}

type RunsListMobileCardsProps = {
  runs: TeamRunRecord[]
}

/**
 * Vista em cartões para viewports estreitas (Loop 73).
 * Paridade com a tabela: estado, run id, time, origem, início, ligação ao time.
 */
export function RunsListMobileCards({ runs }: RunsListMobileCardsProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0 md:hidden" aria-label="Lista de execuções (vista em cartões)">
      {runs.map((r) => (
        <li
          key={r.runId}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={runStatusBadgeVariant(r.status)}>{r.status}</Badge>
            <time
              className="text-xs text-muted-foreground tabular-nums"
              dateTime={r.startedAt}
            >
              {r.startedAt ? new Date(r.startedAt).toLocaleString("pt-BR") : "—"}
            </time>
          </div>
          <h3 className="mt-3 break-all font-mono text-sm font-semibold leading-snug text-foreground">
            {r.runId}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Time</dt>
              <dd className="font-mono text-xs">{r.teamId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Origem</dt>
              <dd className="text-foreground">
                {r.source}
                {r.channel ? ` · ${r.channel}` : ""}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" size="sm" className="mt-4 w-full gap-2 sm:w-auto" asChild>
            <Link href={`/teams/${r.teamId}`}>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Abrir time
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}
