"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { BookmarkCheck, ChevronDown, LifeBuoy, Link2, ShieldCheck, Sparkles, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type AgentFirstVerticalStandardProps = {
  verticalName: string
  summary: string
  readinessTitle: string
  readinessStatusLabel: string
  readinessStatusTone?: "default" | "secondary" | "destructive"
  readinessContent?: ReactNode
  specialistName: string
  teamRecommendation: string
  ctaHref: string
  ctaLabel: string
  starterPrompts: string[]
  fallbackGuidance: string
  troubleshootingItems?: string[]
  /** Texto curto quando o utilizador definiu um time principal da operação (preferência persistida). */
  primaryTeamHint?: string
  /** Ligações secundárias (ex.: consola do time, escritório) — mesmo time, outras superfícies. */
  auxiliaryLinks?: { label: string; href: string }[]
  /** Fixar ou soltar o time actual como “principal da operação” para este workspace. */
  pinPrimaryTeam?: {
    isPinned: boolean
    disabled?: boolean
    onPin: () => void
    onUnpin: () => void
  }
}

export function AgentFirstVerticalStandard({
  verticalName,
  summary,
  readinessTitle,
  readinessStatusLabel,
  readinessStatusTone = "secondary",
  readinessContent,
  specialistName,
  teamRecommendation,
  ctaHref,
  ctaLabel,
  starterPrompts,
  fallbackGuidance,
  troubleshootingItems = [],
  primaryTeamHint,
  auxiliaryLinks = [],
  pinPrimaryTeam,
}: AgentFirstVerticalStandardProps) {
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false)

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 via-transparent to-transparent">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Padrão agent-first
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {verticalName}
          </Badge>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Operação padrão por time especialista</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{summary}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border bg-background/80 p-3 sm:p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {readinessTitle}
            </p>
            <Badge variant={readinessStatusTone} className="mb-2">
              {readinessStatusLabel}
            </Badge>
            {readinessContent ? <div className="text-xs text-muted-foreground">{readinessContent}</div> : null}
          </div>

          <div className="rounded-lg border bg-background/80 p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Especialista do domínio
            </p>
            <p className="text-sm font-medium leading-snug">{specialistName}</p>
            <p className="mt-3 mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Time para esta vertical
            </p>
            <p className="text-sm font-medium leading-snug">{teamRecommendation}</p>
            {primaryTeamHint ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <BookmarkCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{primaryTeamHint}</span>
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border bg-background/80 p-3 sm:p-4 sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrada principal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Conversar com o time operacional da vertical e executar por especialistas.
            </p>
            <Button asChild size="sm" className="mt-3 w-full sm:w-auto">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
            {auxiliaryLinks.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {auxiliaryLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
            {pinPrimaryTeam ? (
              <div className="mt-3">
                {pinPrimaryTeam.isPinned ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={pinPrimaryTeam.disabled}
                    onClick={pinPrimaryTeam.onUnpin}
                  >
                    Deixar de usar este time como principal
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={pinPrimaryTeam.disabled}
                    onClick={pinPrimaryTeam.onPin}
                  >
                    Usar este time como principal em todas as verticais
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-background/80 p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-semibold">Prompts sugeridos para começar</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {starterPrompts.map((prompt) => (
              <li key={prompt} className="rounded-md border border-dashed px-2.5 py-2 leading-relaxed">
                {prompt}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:p-4">
          <p className="mb-1 font-medium text-foreground">Fallback / auditoria / suporte</p>
          <p className="leading-relaxed">{fallbackGuidance}</p>
        </section>

        {troubleshootingItems.length > 0 ? (
          <Collapsible
            open={troubleshootingOpen}
            onOpenChange={setTroubleshootingOpen}
            className="rounded-lg border bg-background/80 p-3 sm:p-4"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                Troubleshooting (camada secundária)
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${troubleshootingOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground sm:text-sm">
                {troubleshootingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  )
}
