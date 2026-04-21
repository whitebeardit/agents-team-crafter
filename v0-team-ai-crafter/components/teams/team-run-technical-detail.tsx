"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TeamRunExecutionEvent, TeamRunResponse } from "@/lib/types"
import { toast } from "sonner"

interface TeamRunTechnicalDetailProps {
  run: TeamRunResponse
  agentNameMap: Record<string, string>
}

function labelForAgent(agentId: string | undefined, names: Record<string, string>): string {
  if (!agentId) return "Sistema"
  return names[agentId] ?? agentId
}

function labelForEvent(event: TeamRunExecutionEvent): string {
  switch (event.type) {
    case "toolCall":
      return "Chamada de tool"
    case "toolResult":
      return "Resultado de tool"
    case "runtimeError":
      return "Erro técnico"
    case "specialistStarted":
      return "Especialista iniciado"
    case "specialistFinished":
      return "Especialista concluído"
    case "coordinatorStarted":
      return "Coordenador iniciado"
    case "coordinatorFinished":
      return "Coordenador concluído"
    case "executionInterrupted":
      return "Execução interrompida"
    default:
      return event.type
  }
}

function analyzeToolInput(value: string | undefined): { isProblem: boolean; reason?: string } {
  if (value == null) return { isProblem: true, reason: "Sem input registado." }
  const trimmed = value.trim()
  if (!trimmed) return { isProblem: true, reason: "Input vazio." }
  if (trimmed === "{}") return { isProblem: true, reason: "Input vazio (`{}`)." }
  try {
    const parsed = JSON.parse(trimmed) as { instruction?: unknown }
    if (
      parsed &&
      typeof parsed === "object" &&
      "instruction" in parsed &&
      typeof parsed.instruction === "string" &&
      !parsed.instruction.trim()
    ) {
      return { isProblem: true, reason: "Campo `instruction` vazio." }
    }
  } catch {
    return { isProblem: false }
  }
  return { isProblem: false }
}

function blockValue(value: string | undefined, fallback: string): string {
  return value != null && value.length > 0 ? value : fallback
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()}`)
  }
}

function DetailBlock({
  title,
  value,
  tone = "default",
  copyLabel,
}: {
  title: string
  value: string
  tone?: "default" | "warning" | "danger"
  copyLabel: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void copyToClipboard(value, copyLabel)}>
          Copiar
        </Button>
      </div>
      <pre
        className={cn(
          "rounded-md border p-3 text-[11px] whitespace-pre-wrap break-words overflow-x-auto",
          tone === "default" && "border-border bg-muted/30",
          tone === "warning" && "border-amber-500/40 bg-amber-500/10",
          tone === "danger" && "border-destructive/40 bg-destructive/10",
        )}
      >
        {value}
      </pre>
    </div>
  )
}

function EventCard({
  event,
  index,
  agentNameMap,
}: {
  event: TeamRunExecutionEvent
  index: number
  agentNameMap: Record<string, string>
}) {
  const callerLabel = labelForAgent(event.invokedByAgentId ?? event.agentId, agentNameMap)
  const targetLabel =
    event.agentId && event.invokedByAgentId && event.agentId !== event.invokedByAgentId
      ? labelForAgent(event.agentId, agentNameMap)
      : null
  const inputCheck = analyzeToolInput(event.toolInput)
  const rawEvent = JSON.stringify(event, null, 2)
  const mainMessage = event.message?.trim() || event.detail?.trim() || null

  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">#{index + 1}</span>
            <span className="text-sm font-medium text-foreground">{labelForEvent(event)}</span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {event.type}
            </span>
            {event.tool ? (
              <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
                {event.tool}
              </span>
            ) : null}
            {event.status ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  event.status === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                )}
              >
                {event.status}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Chamado por: {callerLabel}</span>
            {targetLabel ? <span>Alvo: {targetLabel}</span> : null}
            {event.callId ? <span className="font-mono">callId: {event.callId}</span> : null}
            {event.source ? <span>Origem: {event.source}</span> : null}
            {event.errorCode ? <span className="font-mono">errorCode: {event.errorCode}</span> : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => void copyToClipboard(rawEvent, "Evento")}>
          Copiar evento
        </Button>
      </div>

      {mainMessage ? (
        <div
          className={cn(
            "rounded-md border p-2.5 text-xs whitespace-pre-wrap break-words",
            event.type === "runtimeError" || event.status === "error"
              ? "border-destructive/40 bg-destructive/10"
              : "border-border bg-muted/20",
          )}
        >
          {mainMessage}
        </div>
      ) : null}

      {event.toolInstruction ? (
        <DetailBlock title="Instruction" value={event.toolInstruction} copyLabel="Instruction" />
      ) : null}

      {event.runtimeMessage ? (
        <DetailBlock title="Mensagem enviada ao especialista" value={event.runtimeMessage} copyLabel="Mensagem do especialista" />
      ) : null}

      {event.type === "toolCall" ? (
        <DetailBlock
          title={inputCheck.isProblem ? `Input (${inputCheck.reason})` : "Input"}
          value={blockValue(event.toolInput, "(sem input)")}
          tone={inputCheck.isProblem ? "warning" : "default"}
          copyLabel="Input"
        />
      ) : null}

      {event.type === "toolResult" ? (
        <DetailBlock
          title="Output"
          value={blockValue(event.toolOutput, "(sem output)")}
          tone={event.status === "error" ? "danger" : "default"}
          copyLabel="Output"
        />
      ) : null}
    </li>
  )
}

export function TeamRunTechnicalDetail({ run, agentNameMap }: TeamRunTechnicalDetailProps) {
  const report = JSON.stringify(run, null, 2)

  return (
    <div className="mt-2 space-y-4 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Run:</span> <span className="font-mono">{run.runId}</span>
          </p>
          <p>
            <span className="font-medium text-foreground">Team:</span> <span className="font-mono">{run.teamId}</span>
          </p>
          <p>
            <span className="font-medium text-foreground">Coordenador:</span>{" "}
            {labelForAgent(run.coordinatorAgentId, agentNameMap)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void copyToClipboard(report, "Relatório técnico")}>
          Copiar relatório completo
        </Button>
      </div>

      <DetailBlock
        title="Resposta final"
        value={blockValue(run.externalResponse?.text?.trim(), "(sem resposta final)")}
        copyLabel="Resposta final"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Eventos técnicos ({run.events.length})</p>
        </div>
        {run.events.length > 0 ? (
          <ol className="space-y-2">
            {run.events.map((event, index) => (
              <EventCard key={`${event.type}-${event.callId ?? index}-${index}`} event={event} index={index} agentNameMap={agentNameMap} />
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum evento técnico registado nesta execução.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Resumos dos especialistas ({run.specialistResults.length})</p>
        {run.specialistResults.length > 0 ? (
          <ul className="space-y-2">
            {run.specialistResults.map((result, index) => {
              const value = result.summary?.trim() || "(sem resumo)"
              return (
                <li key={`${result.specialistAgentId}-${index}`} className="rounded-md border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      {labelForAgent(result.specialistAgentId, agentNameMap)}
                    </p>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void copyToClipboard(value, "Resumo do especialista")}>
                      Copiar
                    </Button>
                  </div>
                  <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] whitespace-pre-wrap break-words overflow-x-auto">
                    {value}
                  </pre>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum resumo de especialista foi produzido.</p>
        )}
      </div>
    </div>
  )
}
