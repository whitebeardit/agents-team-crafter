"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, Download, Loader2, MessageSquareCode, Pencil, RefreshCw, Send } from "lucide-react"
import { cn, pickLongestTrimmed } from "@/lib/utils"
import { ApiError, type createApiClient } from "@/lib/api/client"
import { LiveConversationTimelineDrawer } from "@/components/teams/live-conversation-timeline-drawer"
import type {
  TeamConversationTimelineItem,
  TeamDebugLiveMirrorLine,
  TeamDebugSessionSummary,
  TeamDebugSessionTurn,
  TeamGraphLiveAgentState,
  TeamRunExternalImageAttachment,
  TeamRunResponse,
} from "@/lib/types"
import { toast } from "sonner"
import { buildTeamRunNarrativeLines } from "@/components/teams/team-debug-narrative"
import {
  ImagePreviewDialog,
  type ImagePreviewItem,
  ImagePreviewTriggerButton,
} from "@/components/shared/image-preview-dialog"

type Api = ReturnType<typeof createApiClient>

/** react-markdown (passNode) — detectar `<img>` no parágrafo antes do JSX dos components.* */
function hastChildrenSubtreeContainsTag(children: unknown, tagName: string): boolean {
  if (!Array.isArray(children)) return false
  for (const c of children) {
    if (!c || typeof c !== "object") continue
    const child = c as { type?: string; tagName?: string; children?: unknown[] }
    if (child.type === "element" && child.tagName === tagName) return true
    if (child.children && hastChildrenSubtreeContainsTag(child.children, tagName)) return true
  }
  return false
}

function hastParagraphContainsImg(node: unknown): boolean {
  if (!node || typeof node !== "object") return false
  const el = node as { type?: string; tagName?: string; children?: unknown[] }
  if (el.type !== "element" || el.tagName !== "p") return false
  return hastChildrenSubtreeContainsTag(el.children ?? [], "img")
}

export interface TeamDebugConsoleProps {
  teamId: string
  api: Api
  coordinatorLabel?: string
  /** Para narrativa e nomes na timeline (opcional). */
  coordinatorAgentId?: string
  /** id → nome (especialistas + opcionalmente coordenador). */
  agentDisplayNames?: Record<string, string>
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
  /** Mensagens espelhadas do GET /teams/:id/live (ex.: Telegram inbound). */
  liveMirrorLines?: TeamDebugLiveMirrorLine[]
  /** Texto do coordenador em streaming (só inbound no espelho). */
  liveMirrorStreamText?: string | null
  /** Timeline canônica para reutilização da segunda visualização. */
  liveTimelineItems?: TeamConversationTimelineItem[]
  /** Mostra alternância chat/timeline no console. */
  enableTimelineView?: boolean
}

type ChatLine = {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  format?: "plain" | "markdown"
  attachments?: TeamRunExternalImageAttachment[]
  /** Quando o turno veio do histórico persistido no servidor. */
  atLabel?: string
}

function protectedApiPathFromImageSrc(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed) return null
  const stripApiPrefix = (pathname: string, search = "") => {
    const prefix = "/api/v1"
    if (!pathname.startsWith(prefix)) return null
    return `${pathname.slice(prefix.length) || "/"}${search}`
  }
  if (trimmed.startsWith("/api/v1/")) return stripApiPrefix(trimmed) ?? null
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return stripApiPrefix(url.pathname, url.search)
  } catch {
    return null
  }
}

function filenameFromImageSrc(src: string): string | undefined {
  try {
    const pathname = /^https?:\/\//i.test(src) ? new URL(src).pathname : src.split("?")[0] ?? src
    const last = pathname.split("/").filter(Boolean).pop()
    return last ? decodeURIComponent(last) : undefined
  } catch {
    return undefined
  }
}

async function resolveImagePreviewItem(api: Api, src: string, alt: string): Promise<ImagePreviewItem> {
  const protectedPath = protectedApiPathFromImageSrc(src)
  if (!protectedPath) return { src, alt, filename: filenameFromImageSrc(src) }

  const res = await api.fetchAuthorized(protectedPath)
  if (!res.ok) throw new Error(`Imagem protegida HTTP ${res.status}`)
  const blob = await res.blob()
  return {
    src: URL.createObjectURL(blob),
    alt,
    filename: filenameFromImageSrc(src),
  }
}

function MarkdownImagePreview({
  api,
  src,
  alt,
  onOpen,
  onDownload,
}: {
  api: Api
  src: string
  alt: string
  onOpen: (src: string, alt: string) => void
  onDownload: (item: ImagePreviewItem) => void | Promise<void>
}) {
  const [item, setItem] = useState<ImagePreviewItem | null>(() =>
    protectedApiPathFromImageSrc(src) ? null : { src, alt, filename: filenameFromImageSrc(src) },
  )

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    if (!protectedApiPathFromImageSrc(src)) return
    void (async () => {
      try {
        const resolved = await resolveImagePreviewItem(api, src, alt)
        if (cancelled) {
          if (resolved.src.startsWith("blob:")) URL.revokeObjectURL(resolved.src)
          return
        }
        if (resolved.src.startsWith("blob:")) objectUrl = resolved.src
        setItem(resolved)
      } catch {
        if (!cancelled) setItem({ src, alt, filename: filenameFromImageSrc(src) })
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [api, alt, src])

  if (!item && protectedApiPathFromImageSrc(src)) {
    return <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">A carregar imagem...</div>
  }
  const current = item ?? { src, alt, filename: filenameFromImageSrc(src) }
  return (
    <div className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.src}
        alt={current.alt ?? ""}
        className="max-h-48 max-w-full rounded-md border border-border object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="flex items-center gap-1 justify-end">
        <ImagePreviewTriggerButton onClick={() => onOpen(src, alt)} />
        <Button
          size="icon"
          variant="secondary"
          onClick={() => void onDownload(current)}
          aria-label="Download da imagem"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function AssistantMessageBody({ line, api }: { line: ChatLine; api: Api }) {
  const { content, format, attachments, streaming } = line
  const showGallery = Boolean(attachments && attachments.length > 0 && !streaming)
  const useMd = format === "markdown" && !streaming
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItems, setPreviewItems] = useState<ImagePreviewItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [resolvedGallery, setResolvedGallery] = useState<{ key: string; items: ImagePreviewItem[] }>({ key: "", items: [] })

  const fallbackGalleryItems: ImagePreviewItem[] = useMemo(
    () => (attachments ?? []).map((a, i) => ({ src: a.url, alt: `Imagem anexada ${i + 1}` })),
    [attachments],
  )
  const galleryKey = useMemo(() => (attachments ?? []).map((a) => a.url).join("\n"), [attachments])
  const resolvedGalleryItems = resolvedGallery.key === galleryKey ? resolvedGallery.items : []

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    if (!attachments?.length || streaming) return
    void (async () => {
      const next = await Promise.all(
        attachments.map(async (a, i) => {
          const resolved = await resolveImagePreviewItem(api, a.url, `Imagem anexada ${i + 1}`).catch(
            () => fallbackGalleryItems[i] ?? { src: a.url, alt: `Imagem anexada ${i + 1}` },
          )
          if (resolved.src.startsWith("blob:")) objectUrls.push(resolved.src)
          return resolved
        }),
      )
      if (cancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      setResolvedGallery({ key: galleryKey, items: next })
    })()
    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [api, attachments, fallbackGalleryItems, galleryKey, streaming])

  function openPreview(items: ImagePreviewItem[], idx: number) {
    setPreviewItems(items)
    setPreviewIndex(idx)
    setPreviewOpen(true)
  }

  async function downloadImage(item: ImagePreviewItem) {
    try {
      const res = await fetch(item.src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = item.filename ?? "imagem.png"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(item.src, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="space-y-2">
      {showGallery ? (
        <div className="flex flex-wrap gap-2">
          {attachments!.map((a, i) => {
            const item = resolvedGalleryItems[i] ?? fallbackGalleryItems[i] ?? { src: a.url, alt: `Imagem anexada ${i + 1}` }
            const isLoadingProtected = !resolvedGalleryItems[i] && protectedApiPathFromImageSrc(a.url)
            return (
              <div key={`${a.url}-${i}`} className="space-y-1">
                {isLoadingProtected ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">A carregar imagem...</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="max-h-48 max-w-full rounded-md border border-border object-contain bg-background"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="flex items-center gap-1 justify-end">
                  {!isLoadingProtected ? (
                    <ImagePreviewTriggerButton onClick={() => openPreview(resolvedGalleryItems.length ? resolvedGalleryItems : fallbackGalleryItems, i)} />
                  ) : null}
                  <Button size="icon" variant="secondary" onClick={() => void downloadImage(item)} aria-label="Download da imagem">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
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
              /** Img é substituída por `<div>`; parágrafos com imagem devem ser `<div>` (HTML válido). */
              p: ({ node, children }) =>
                hastParagraphContainsImg(node) ? (
                  <div className="mb-2 last:mb-0">{children}</div>
                ) : (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
              img: ({ src, alt }) => {
                const srcUrl = typeof src === "string" ? src : ""
                return (
                  <MarkdownImagePreview
                    key={srcUrl}
                    api={api}
                    src={srcUrl}
                    alt={alt ?? "Imagem markdown"}
                    onOpen={(sourceSrc, imageAlt) => {
                      void (async () => {
                        const item = await resolveImagePreviewItem(api, sourceSrc, imageAlt).catch(() => ({
                          src: sourceSrc,
                          alt: imageAlt,
                          filename: filenameFromImageSrc(sourceSrc),
                        }))
                        openPreview([item], 0)
                      })()
                    }}
                    onDownload={(item) => downloadImage(item)}
                  />
                )
              },
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
      <ImagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        initialIndex={previewIndex}
        onDownload={(item) => downloadImage(item)}
      />
    </div>
  )
}

export function TeamDebugConsole({
  teamId,
  api,
  coordinatorLabel,
  coordinatorAgentId,
  agentDisplayNames,
  useHttpRun: useHttpRunProp,
  useStreamRun = false,
  onLiveAgentStatus,
  onStreamFinished,
  className,
  variant = "default",
  hideHeader = false,
  liveMirrorLines = [],
  liveMirrorStreamText = null,
  liveTimelineItems = [],
  enableTimelineView = false,
}: TeamDebugConsoleProps) {
  const compact = variant === "compact"
  const useHttpRun = useHttpRunProp ?? !useStreamRun
  const [conversationId, setConversationId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  )
  const [input, setInput] = useState("")
  const [lines, setLines] = useState<ChatLine[]>([])
  const [lastRaw, setLastRaw] = useState<TeamRunResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)
  const [narrativeOpen, setNarrativeOpen] = useState(true)
  const [sessions, setSessions] = useState<TeamDebugSessionSummary[]>([])
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({})
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"chat" | "timeline">("chat")

  const agentNameMap = useMemo(() => {
    const m: Record<string, string> = { ...(agentDisplayNames ?? {}) }
    if (coordinatorAgentId && coordinatorLabel) {
      m[coordinatorAgentId] = coordinatorLabel
    }
    return m
  }, [agentDisplayNames, coordinatorAgentId, coordinatorLabel])

  const narrativeLines = useMemo(() => {
    if (!lastRaw) return []
    return buildTeamRunNarrativeLines(lastRaw.events ?? [], lastRaw.specialistResults ?? [], agentNameMap)
  }, [lastRaw, agentNameMap])

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await api.get<{ items: TeamDebugSessionSummary[] }>(`/teams/${teamId}/debug-sessions`)
      setSessions(res.data.items ?? [])
      setSessionTitles((prev) => {
        const next = { ...prev }
        for (const item of res.data.items ?? []) {
          if (item.shortTitle?.trim()) next[item.conversationId] = item.shortTitle.trim()
        }
        return next
      })
    } catch {
      /* silencioso — lista é auxiliar */
    } finally {
      setSessionsLoading(false)
    }
  }, [api, teamId])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const applyTurnsFromServer = useCallback((turns: TeamDebugSessionTurn[]) => {
    setLines(
      turns.map((t) => {
        let atLabel: string | undefined
        try {
          atLabel = format(parseISO(t.at), "dd/MM/yyyy HH:mm", { locale: ptBR })
        } catch {
          atLabel = undefined
        }
        return {
          role: t.role,
          content: t.content,
          format: t.format,
          attachments: t.attachments,
          atLabel,
        }
      }),
    )
  }, [])

  const loadSessionHistory = useCallback(
    async (cid: string) => {
      try {
        const res = await api.get<{ conversationId: string; turns: TeamDebugSessionTurn[]; shortTitle?: string }>(
          `/teams/${teamId}/debug-sessions/${encodeURIComponent(cid)}`,
        )
        applyTurnsFromServer(res.data.turns ?? [])
        setConversationId(res.data.conversationId)
        if (res.data.shortTitle?.trim()) {
          setSessionTitles((prev) => ({ ...prev, [res.data.conversationId]: res.data.shortTitle!.trim() }))
        }
        setLastRaw(null)
      } catch (e) {
        const err = e as ApiError
        toast.error(err.message ?? "Não foi possível carregar a sessão")
      }
    },
    [api, teamId, applyTurnsFromServer],
  )

  const sessionOptions = useMemo(() => {
    const list: TeamDebugSessionSummary[] = [...sessions]
    if (!list.some((s) => s.conversationId === conversationId)) {
      list.push({
        conversationId,
        updatedAt: new Date().toISOString(),
        turnCount: lines.length,
        shortTitle: sessionTitles[conversationId],
      })
    }
    return list.sort((a, b) => parseISO(b.updatedAt).getTime() - parseISO(a.updatedAt).getTime())
  }, [sessions, conversationId, lines.length, sessionTitles])

  const renameSession = useCallback(async () => {
    const currentTitle = sessionTitles[conversationId] ?? ""
    const next = window.prompt("Novo título curto da sessão", currentTitle)
    const value = next?.trim()
    if (!value) return
    try {
      const res = await api.patch<{ shortTitle: string }>(
        `/teams/${teamId}/debug-sessions/${encodeURIComponent(conversationId)}/title`,
        { shortTitle: value },
      )
      const title = res.data.shortTitle?.trim() || value
      setSessionTitles((prev) => ({ ...prev, [conversationId]: title }))
      setSessions((prev) =>
        prev.map((s) => (s.conversationId === conversationId ? { ...s, shortTitle: title } : s)),
      )
      toast.success("Título da sessão atualizado")
      void refreshSessions()
    } catch (e) {
      const err = e as ApiError
      toast.error(err.message ?? "Não foi possível atualizar o título")
    }
  }, [api, conversationId, refreshSessions, sessionTitles, teamId])

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
        { message, channel: "debug", conversationId },
        {
          onAgentStatus: (e) => {
            onLiveAgentStatus?.(e.agentId, {
              status: e.status,
              phase: e.phase,
              lastActivity: e.detail ?? e.phase,
            })
          },
          onCoordinatorDelta: (payload) => {
            assistantBuffer += payload.text
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
                const text = pickLongestTrimmed(er?.text, assistantBuffer) || "(sem texto)"
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
            void refreshSessions()
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
          conversationId,
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
        void refreshSessions()
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
    conversationId,
    refreshSessions,
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
              {" · "}
              <span className="font-mono text-[10px]" title="ID da conversa (memória no servidor)">
                {conversationId.slice(0, 8)}…
              </span>
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b border-border bg-muted/15 shrink-0",
          compact ? "px-3 py-2" : "px-4 py-2",
        )}
      >
        {enableTimelineView ? (
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <Button
              type="button"
              variant={viewMode === "chat" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setViewMode("chat")}
            >
              Chat
            </Button>
            <Button
              type="button"
              variant={viewMode === "timeline" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setViewMode("timeline")}
            >
              Timeline
            </Button>
          </div>
        ) : null}
        <span className={cn("text-muted-foreground shrink-0", compact ? "text-[10px]" : "text-xs")}>Sessão</span>
        <Select
          value={conversationId}
          onValueChange={(v) => {
            void loadSessionHistory(v)
          }}
          disabled={busy}
        >
          <SelectTrigger className={cn("w-[min(100%,300px)]", compact ? "h-8 text-xs" : "")}>
            <SelectValue placeholder="Conversa" />
          </SelectTrigger>
          <SelectContent align="start">
            {sessionOptions.map((s) => {
              let rel = ""
              try {
                rel = formatDistanceToNow(parseISO(s.updatedAt), { locale: ptBR, addSuffix: true })
              } catch {
                rel = ""
              }
              return (
                <SelectItem key={s.conversationId} value={s.conversationId} className="text-xs">
                  <span>{s.shortTitle?.trim() || sessionTitles[s.conversationId] || "Sessão sem título"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · <span className="font-mono">{s.conversationId.slice(0, 8)}…</span> · {s.turnCount} trocas · {rel}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("shrink-0", compact ? "h-8 w-8" : "h-9 w-9")}
          disabled={busy}
          onClick={() => void renameSession()}
          title="Editar título da sessão"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("shrink-0", compact ? "h-8 w-8" : "h-9 w-9")}
          disabled={sessionsLoading || busy}
          onClick={() => void refreshSessions()}
          title="Actualizar lista de sessões"
        >
          <RefreshCw className={cn("h-4 w-4", sessionsLoading && "animate-spin")} />
        </Button>
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto space-y-3 min-h-0",
          compact ? "p-3" : "max-h-[360px] p-4",
          hideHeader && compact && "pt-1",
        )}
      >
        {enableTimelineView && viewMode === "timeline" ? (
          <LiveConversationTimelineDrawer
            items={liveTimelineItems}
            agentDisplayNames={agentNameMap}
            density={compact ? "compact" : "detailed"}
            title="Timeline da sessão live"
            emptyLabel="Sem eventos para esta sessão."
          />
        ) : null}
        {(!enableTimelineView || viewMode === "chat") && (
          <>
        {liveMirrorLines.length > 0 || (liveMirrorStreamText != null && liveMirrorStreamText.length > 0) ? (
          <div className="space-y-2 mb-3 pb-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Espelho live (inbound)</p>
            {liveMirrorLines.map((line, idx) => (
              <div
                key={`mir-${idx}-${line.role}`}
                className={cn(
                  "text-sm rounded-lg px-3 py-2 max-w-[95%]",
                  line.role === "user"
                    ? "ml-auto bg-primary/10 text-foreground border border-dashed border-primary/30"
                    : "mr-auto bg-muted/60 text-foreground border border-border",
                )}
              >
                {line.sourceLabel ? (
                  <p className="text-[10px] text-muted-foreground mb-1">{line.sourceLabel}</p>
                ) : null}
                {line.role === "user" ? (
                  <p className="whitespace-pre-wrap break-words">{line.content}</p>
                ) : (
                  <AssistantMessageBody
                    api={api}
                    line={{
                      role: "assistant",
                      content: line.content,
                      format: line.format,
                    }}
                  />
                )}
              </div>
            ))}
            {liveMirrorStreamText != null && liveMirrorStreamText.length > 0 ? (
              <div className="text-sm rounded-lg px-3 py-2 max-w-[95%] mr-auto bg-muted/40 text-foreground border border-dashed border-border">
                <p className="text-[10px] text-muted-foreground mb-1">Coordenador (a gerar)</p>
                <AssistantMessageBody
                  api={api}
                  line={{
                    role: "assistant",
                    content: liveMirrorStreamText,
                    streaming: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {lines.length === 0 && liveMirrorLines.length === 0 && !(liveMirrorStreamText != null && liveMirrorStreamText.length > 0) ? (
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
                <AssistantMessageBody line={line} api={api} />
              )}
              {line.atLabel ? (
                <p className="text-[10px] text-muted-foreground mt-1.5 opacity-90">{line.atLabel}</p>
              ) : null}
            </div>
          ))
        )}
          </>
        )}
      </div>

      <div className={cn("border-t border-border space-y-2 shrink-0", compact ? "p-3" : "p-4 space-y-3")}>
        {lastRaw && narrativeLines.length > 0 ? (
          <Collapsible open={narrativeOpen} onOpenChange={setNarrativeOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground px-0 h-auto w-full justify-start">
                <ChevronDown className={cn("w-4 h-4 transition-transform shrink-0", narrativeOpen && "rotate-180")} />
                Fluxo da última execução (narrativa)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 space-y-1.5 text-xs text-foreground border border-border rounded-md p-3 bg-muted/30 list-decimal list-inside">
                {narrativeLines.map((nl, i) => (
                  <li
                    key={`nar-${i}`}
                    className={cn(
                      "pl-1 marker:text-muted-foreground",
                      nl.kind === "summary" && "text-muted-foreground list-[circle]",
                    )}
                  >
                    {nl.text}
                  </li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

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
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-2" disabled={busy || !input.trim()} onClick={() => void send()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? "A executar..." : "Enviar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setConversationId(
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              )
              setLines([])
              setLastRaw(null)
              void refreshSessions()
            }}
          >
            Nova conversa
          </Button>
        </div>

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
