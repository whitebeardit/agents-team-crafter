"use client"

import { useCallback, useState } from "react"
import ReactMarkdown from "react-markdown"
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
import type {
  TeamGraphLiveAgentState,
  TeamRunExternalImageAttachment,
  TeamRunResponse,
} from "@/lib/types"
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
  /** Painel lateral (Sheet): menos altura mínima e área de mensagens com scroll. */
  variant?: "default" | "compact"
  /** Quando o título está no contentor pai (ex.: SheetHeader). */
  hideHeader?: boolean
}

type ChatLine = {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  format?: "plain" | "markdown"
  attachments?: TeamRunExternalImageAttachment[]
}

function AssistantMessageBody({ line }: { line: ChatLine }) {
  const { content, format, attachments, streaming } = line
  const showGallery = Boolean(attachments && attachments.length > 0 && !streaming)
  const useMd = format === "markdown" && !streaming

  return (
    <div className="space-y-2">
      {showGallery ? (
        <div className="flex flex-wrap gap-2">
          {attachments!.map((a, i) => (
            // Remote coordinator URLs are arbitrary; next/image would require per-domain config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${a.url}-${i}`}
              src={a.url}
              alt=""
              className="max-h-48 max-w-full rounded-md border border-border object-contain bg-background"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      ) : null}
      {streaming ? (
        <p className="whitespace-pre-wrap break-words">
          {content}
          <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-primary/50 animate-pulse" />
        </p>
      ) : useMd ? (
        <div className="break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:text-xs">
          <ReactMarkdown
            components={{
              img: ({ src, alt }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt ?? ""}
                  className="max-h-48 max-w-full rounded-md border border-border object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words">{content}</p>
      )}
    </div>
  )
}

export function TeamDebugConsole({
  teamId,
  api,
  coordinatorLabel,
  useHttpRun: useHttpRunProp,
  useStreamRun = false,
  onLiveAgentStatus,
  onStreamFinished,
  className,
  variant = "default",
  hideHeader = false,
}: TeamDebugConsoleProps) {
  const compact = variant === "compact"
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
                const er = data.externalResponse
                const text = er?.text?.trim() || assistantBuffer || "(sem texto)"
                next[i] = {
                  role: "assistant",
                  content: text,
                  streaming: false,
                  format: er?.format,
                  attachments: er?.attachments,
                }
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
        const er = res.data.externalResponse
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: er?.text?.trim() || "(resposta vazia)",
            format: er?.format,
            attachments: er?.attachments,
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
    <div
      className={cn(
        "rounded-lg border border-border bg-card flex flex-col",
        compact ? "min-h-0 flex-1 border-0 shadow-none rounded-none" : "min-h-[320px]",
        className,
      )}
    >
      {!hideHeader ? (
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border shrink-0",
            compact ? "px-3 py-2" : "px-4 py-3",
          )}
        >
          <MessageSquareCode className={cn("text-primary shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          <div className="min-w-0">
            <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>Console do coordenador</p>
            <p className={cn("text-muted-foreground", compact ? "text-[10px] leading-tight" : "text-xs")}>
              Canal local <code className="text-[10px] bg-muted px-1 rounded">debug</code>
              {coordinatorLabel ? ` · ${coordinatorLabel}` : ""}
              {useStreamRun ? " · SSE live" : ""}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "flex-1 overflow-y-auto space-y-3 min-h-0",
          compact ? "p-3" : "max-h-[360px] p-4",
          hideHeader && compact && "pt-1",
        )}
      >
        {lines.length === 0 ? (
          <p className={cn("text-muted-foreground", compact ? "text-xs leading-snug" : "text-sm")}>
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
              {line.role === "user" ? (
                <p className="whitespace-pre-wrap break-words">{line.content}</p>
              ) : (
                <AssistantMessageBody line={line} />
              )}
            </div>
          ))
        )}
      </div>

      <div className={cn("border-t border-border space-y-2 shrink-0", compact ? "p-3" : "p-4 space-y-3")}>
        <Textarea
          placeholder="Mensagem para o coordenador..."
          value={input}
          disabled={busy}
          rows={compact ? 2 : 3}
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
