"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Loader2, MessageSquareCode, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError, type createApiClient } from "@/lib/api/client"
import type { TeamGraphLiveAgentState, TeamRunResponse } from "@/lib/types"
import { toast } from "sonner"

type Api = ReturnType<typeof createApiClient>

export interface TeamDebugConsoleProps {
  teamId: string
  api: Api
  coordinatorLabel?: string
  /** Usa POST /teams/:id/run (resposta completa de uma vez). Predefinido: true se nem stream estiver ativo. */
  useHttpRun?: boolean
  /** Usa POST /teams/:id/run/stream com SSE (modo live no grafo). */
  useStreamRun?: boolean
  /** Cada atualização de agente (SSE) para pintar o grafo. */
  onLiveAgentStatus?: (agentId: string, state: TeamGraphLiveAgentState) => void
  onStreamFinished?: () => void
  className?: string
}

type ChatLine = { role: "user" | "assistant"; content: string; streaming?: boolean }

export function TeamDebugConsole({
  teamId,
  api,
  coordinatorLabel,
  useHttpRun: useHttpRunProp,
  useStreamRun = false,
  onLiveAgentStatus,
  onStreamFinished,
  className,
}: TeamDebugConsoleProps) {
  const useHttpRun = useHttpRunProp ?? !useStreamRun
  const [input, setInput] = useState("")
  const [lines, setLines] = useState<ChatLine[]>([])
  const [lastRaw, setLastRaw] = useState<TeamRunResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)

  const send = useCallback(async () => {
    const message = input.trim()
    if (!message || busy) return
    setInput("")
    setLastRaw(null)
    setLines((prev) => [...prev, { role: "user", content: message }])
    setBusy(true)

    if (useStreamRun) {
      let assistantBuffer = ""
      setLines((prev) => [...prev, { role: "assistant", content: "", streaming: true }])

      await api.streamTeamRun(
        teamId,
        { message, channel: "debug" },
        {
          onAgentStatus: (e) => {
            onLiveAgentStatus?.(e.agentId, {
              status: e.status,
              phase: e.phase,
              lastActivity: e.detail ?? e.phase,
            })
          },
          onCoordinatorDelta: (text) => {
            assistantBuffer += text
            setLines((prev) => {
              const next = [...prev]
              const i = next.length - 1
              if (i >= 0 && next[i].role === "assistant" && next[i].streaming) {
                next[i] = { ...next[i], content: assistantBuffer }
              }
              return next
            })
          },
          onRunComplete: (data) => {
            setLastRaw(data)
            setLines((prev) => {
              const next = [...prev]
              const i = next.length - 1
              if (i >= 0 && next[i].role === "assistant") {
                const text =
                  data.externalResponse?.text?.trim() ||
                  assistantBuffer ||
                  "(sem texto)"
                next[i] = { role: "assistant", content: text, streaming: false }
              }
              return next
            })
          },
          onError: (err) => {
            toast.error(err.message ?? "Falha no stream do time")
            setLines((prev) => {
              const next = [...prev]
              const i = next.length - 1
              if (i >= 0 && next[i].role === "assistant" && next[i].streaming) {
                next[i] = {
                  role: "assistant",
                  content: next[i].content || `(erro: ${err.message})`,
                  streaming: false,
                }
              }
              return next
            })
          },
        },
      )
      setBusy(false)
      onStreamFinished?.()
      return
    }

    if (useHttpRun) {
      try {
        const res = await api.post<TeamRunResponse>(`/teams/${teamId}/run`, {
          message,
          channel: "debug",
        })
        setLastRaw(res.data)
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.data.externalResponse?.text?.trim() || "(resposta vazia)",
          },
        ])
      } catch (e) {
        const err = e as ApiError
        toast.error(err.message ?? "Falha ao executar time")
        setLines((prev) => [
          ...prev,
          { role: "assistant", content: `Erro: ${err.message ?? "desconhecido"}` },
        ])
      } finally {
        setBusy(false)
      }
    }
  }, [
    api,
    busy,
    input,
    onLiveAgentStatus,
    onStreamFinished,
    teamId,
    useHttpRun,
    useStreamRun,
  ])

  return (
    <div className={cn("rounded-lg border border-border bg-card flex flex-col min-h-[320px]", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquareCode className="w-4 h-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Console do coordenador</p>
          <p className="text-xs text-muted-foreground">
            Canal local <code className="text-xs bg-muted px-1 rounded">debug</code>
            {coordinatorLabel ? ` · ${coordinatorLabel}` : ""}
            {useStreamRun ? " · SSE live" : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Envie uma mensagem para testar o mesmo runtime que produção (OpenAI Agents SDK), sem Slack ou Discord.
          </p>
        ) : (
          lines.map((line, idx) => (
            <div
              key={`${idx}-${line.role}`}
              className={cn(
                "text-sm rounded-lg px-3 py-2 max-w-[95%]",
                line.role === "user"
                  ? "ml-auto bg-primary/15 text-foreground"
                  : "mr-auto bg-muted/80 text-foreground border border-border",
              )}
            >
              <p className="whitespace-pre-wrap break-words">
                {line.content}
                {line.streaming ? (
                  <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-primary/50 animate-pulse" />
                ) : null}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        <Textarea
          placeholder="Mensagem para o coordenador..."
          value={input}
          disabled={busy}
          rows={3}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          className="resize-none"
        />
        <Button type="button" className="gap-2" disabled={busy || !input.trim()} onClick={() => void send()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? "A executar..." : "Enviar"}
        </Button>

        {lastRaw ? (
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground px-0 h-auto">
                <ChevronDown className={cn("w-4 h-4 transition-transform", rawOpen && "rotate-180")} />
                Detalhe técnico (especialistas e eventos)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-48 overflow-y-auto border border-border">
                {JSON.stringify(
                  {
                    specialistResults: lastRaw.specialistResults,
                    events: lastRaw.events,
                  },
                  null,
                  2,
                )}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </div>
  )
}
