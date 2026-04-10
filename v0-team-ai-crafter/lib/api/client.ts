import type {
  TeamCoordinatorDeltaPayload,
  TeamLiveInboundUserMessage,
  TeamRunProgressEvent,
  TeamRunRequest,
  TeamRunResponse,
} from "@/lib/types"

export interface ISuccessEnvelope<T> {
  success: true
  data: T
  meta: Record<string, unknown>
}

export interface IErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}

export type IEnvelope<T> = ISuccessEnvelope<T> | IErrorEnvelope

export class ApiError extends Error {
  code: string
  details: Record<string, unknown>
  status: number

  constructor(input: { code: string; message: string; details?: Record<string, unknown>; status: number }) {
    super(input.message)
    this.name = "ApiError"
    this.code = input.code
    this.details = input.details ?? {}
    this.status = input.status
  }
}

/**
 * Base do BFF: `NEXT_PUBLIC_API_URL` (build-time) quando definida — obrigatório em produção HTTPS
 * atrás de proxy (Coolify): a porta 3001 no host costuma ser HTTP cru; usar `https://...` nessa porta
 * causa ERR_SSL_PROTOCOL_ERROR. Sem env no browser, cai no fallback hostname:3001 (dev local).
 */
function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
  if (typeof window !== "undefined") {
    if (fromEnv) return fromEnv
    const protocol = window.location.protocol === "https:" ? "https:" : "http:"
    const host = window.location.hostname
    return `${protocol}//${host}:3001/api/v1`.replace(/\/+$/, "")
  }
  if (!fromEnv) throw new Error("NEXT_PUBLIC_API_URL is not set")
  return fromEnv
}

function joinUrl(base: string, path: string) {
  if (!path.startsWith("/")) path = `/${path}`
  return `${base}${path}`
}

async function parseEnvelope<T>(res: Response): Promise<ISuccessEnvelope<T>> {
  const text = await res.text()
  const json = text ? (JSON.parse(text) as IEnvelope<T>) : (null as unknown as IEnvelope<T>)

  if (!res.ok) {
    if (json && json.success === false) {
      throw new ApiError({
        code: json.error.code,
        message: json.error.message,
        details: json.error.details ?? {},
        status: res.status,
      })
    }
    throw new ApiError({
      code: res.status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR",
      message: "Request failed",
      details: {},
      status: res.status,
    })
  }

  if (!json || json.success !== true) {
    throw new ApiError({
      code: "INVALID_ENVELOPE",
      message: "Unexpected response format",
      details: {},
      status: res.status,
    })
  }

  // Ensure meta always exists (backend always sends, but tolerate older/malformed responses)
  return { ...json, meta: json.meta ?? {} }
}

type GetAuth = () => { token?: string | null; refreshToken?: string | null }
type SetAuth = (auth: { token: string; refreshToken?: string }) => void
type ClearAuth = () => void
type GetWorkspaceId = () => string | null | undefined

/** Parse Server-Sent Events body (fetch streaming). */
async function consumeSseResponse(
  res: Response,
  onParsed: (eventName: string, data: string) => void,
): Promise<void> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error("Resposta sem corpo legivel")
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ""
    for (const block of blocks) {
      let eventName = "message"
      const dataLines: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim()
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
      }
      if (dataLines.length > 0) onParsed(eventName, dataLines.join("\n"))
    }
  }
}

export interface ITeamRunStreamHandlers {
  onAgentStatus?: (e: TeamRunProgressEvent) => void
  onCoordinatorDelta?: (payload: TeamCoordinatorDeltaPayload) => void
  onRunComplete?: (data: TeamRunResponse) => void
  onError?: (e: { code?: string; message: string; status?: number }) => void
}

/** Handlers para `GET /teams/:id/live` (inclui espelho inbound). */
export interface ITeamLiveStreamHandlers extends ITeamRunStreamHandlers {
  onInboundUserMessage?: (data: TeamLiveInboundUserMessage) => void
}

export interface ITeamPlanExecuteStreamHandlers<T> {
  onPhase?: (e: {
    phase: "creating_agents" | "binding_tools" | "creating_team" | "graph" | "activate"
    detail?: string
  }) => void
  onComplete?: (data: T) => void
  onError?: (e: { code?: string; message: string; status?: number }) => void
}

export function createApiClient(deps: {
  getAuth: GetAuth
  setAuth: SetAuth
  clearAuth: ClearAuth
  getWorkspaceId: GetWorkspaceId
}) {
  async function refreshTokenIfPossible() {
    const { refreshToken } = deps.getAuth()
    if (!refreshToken) return false
    const baseUrl = getBaseUrl()
    const res = await fetch(joinUrl(baseUrl, "/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    const env = await parseEnvelope<{ token: string; refreshToken: string; expiresAt: string }>(res)
    deps.setAuth({ token: env.data.token, refreshToken: env.data.refreshToken })
    return true
  }

  async function request<T>(
    path: string,
    init: RequestInit & { tenant?: boolean } = { tenant: true },
  ): Promise<ISuccessEnvelope<T>> {
    const baseUrl = getBaseUrl()
    const { token } = deps.getAuth()

    const headers = new Headers(init.headers)
    if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json")
    if (token) headers.set("Authorization", `Bearer ${token}`)
    if (init.tenant !== false) {
      const wid = deps.getWorkspaceId()
      if (wid) headers.set("X-Workspace-Id", wid)
    }

    const doFetch = () =>
      fetch(joinUrl(baseUrl, path), {
        ...init,
        headers,
      })

    let res = await doFetch()
    if (res.status === 401) {
      const refreshed = await refreshTokenIfPossible()
      if (refreshed) {
        const { token: newToken } = deps.getAuth()
        if (newToken) headers.set("Authorization", `Bearer ${newToken}`)
        res = await doFetch()
      } else {
        deps.clearAuth()
      }
    }

    return parseEnvelope<T>(res)
  }

  /** GET com os mesmos headers de tenant/JWT que `request`; devolve `Response` bruto (imagens, blobs). */
  async function fetchAuthorized(
    path: string,
    init: RequestInit & { tenant?: boolean } = { tenant: true },
  ): Promise<Response> {
    const baseUrl = getBaseUrl()
    const { token } = deps.getAuth()
    const headers = new Headers(init.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    if (init.tenant !== false) {
      const wid = deps.getWorkspaceId()
      if (wid) headers.set("X-Workspace-Id", wid)
    }
    const doFetch = () =>
      fetch(joinUrl(baseUrl, path), {
        ...init,
        headers,
      })
    let res = await doFetch()
    if (res.status === 401) {
      const refreshed = await refreshTokenIfPossible()
      if (refreshed) {
        const { token: newToken } = deps.getAuth()
        if (newToken) headers.set("Authorization", `Bearer ${newToken}`)
        res = await doFetch()
      } else {
        deps.clearAuth()
      }
    }
    return res
  }

  async function streamTeamRun(teamId: string, body: TeamRunRequest, handlers: ITeamRunStreamHandlers) {
    const baseUrl = getBaseUrl()
    const path = `/teams/${teamId}/run/stream`

    const buildHeaders = () => {
      const headers = new Headers({ "Content-Type": "application/json" })
      const { token } = deps.getAuth()
      if (token) headers.set("Authorization", `Bearer ${token}`)
      const wid = deps.getWorkspaceId()
      if (wid) headers.set("X-Workspace-Id", wid)
      return headers
    }

    const doFetch = () =>
      fetch(joinUrl(baseUrl, path), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(body),
      })

    let res = await doFetch()
    if (res.status === 401) {
      const refreshed = await refreshTokenIfPossible()
      if (refreshed) res = await doFetch()
      else deps.clearAuth()
    }

    if (!res.ok) {
      let message = await res.text()
      if (!message) message = res.statusText
      try {
        const j = JSON.parse(message) as { error?: { message?: string; code?: string } }
        if (j?.error?.message) message = j.error.message
      } catch {
        /* ignore */
      }
      handlers.onError?.({ message, status: res.status })
      return
    }

    await consumeSseResponse(res, (eventName, dataJson) => {
      try {
        const data = JSON.parse(dataJson) as unknown
        if (eventName === "agentStatus") handlers.onAgentStatus?.(data as TeamRunProgressEvent)
        else if (eventName === "coordinatorDelta") {
          const d = data as TeamCoordinatorDeltaPayload
          if (d.text) handlers.onCoordinatorDelta?.(d)
        } else if (eventName === "runComplete") {
          handlers.onRunComplete?.(data as TeamRunResponse)
        } else if (eventName === "error") {
          const d = data as { code?: string; message?: string; status?: number }
          handlers.onError?.({
            code: d.code,
            message: d.message ?? "Erro no stream",
            status: d.status,
          })
        }
      } catch {
        /* chunk invalido */
      }
    })
  }

  /** GET SSE: mesmo formato que `streamTeamRun` (inbound Chat SDK + runs manuais publicados no bus). */
  async function streamTeamLive(teamId: string, handlers: ITeamLiveStreamHandlers, signal?: AbortSignal) {
    const baseUrl = getBaseUrl()
    const path = `/teams/${teamId}/live`

    const buildHeaders = () => {
      const headers = new Headers()
      const { token } = deps.getAuth()
      if (token) headers.set("Authorization", `Bearer ${token}`)
      const wid = deps.getWorkspaceId()
      if (wid) headers.set("X-Workspace-Id", wid)
      return headers
    }

    const doFetch = () =>
      fetch(joinUrl(baseUrl, path), {
        method: "GET",
        headers: buildHeaders(),
        signal,
      })

    let res = await doFetch()
    if (res.status === 401) {
      const refreshed = await refreshTokenIfPossible()
      if (refreshed) res = await doFetch()
      else deps.clearAuth()
    }

    if (!res.ok) {
      let message = await res.text()
      if (!message) message = res.statusText
      try {
        const j = JSON.parse(message) as { error?: { message?: string; code?: string } }
        if (j?.error?.message) message = j.error.message
      } catch {
        /* ignore */
      }
      handlers.onError?.({ message, status: res.status })
      return
    }

    await consumeSseResponse(res, (eventName, dataJson) => {
      try {
        const data = JSON.parse(dataJson) as unknown
        if (eventName === "agentStatus") handlers.onAgentStatus?.(data as TeamRunProgressEvent)
        else if (eventName === "coordinatorDelta") {
          const d = data as TeamCoordinatorDeltaPayload
          if (d.text) handlers.onCoordinatorDelta?.(d)
        } else if (eventName === "runComplete") {
          handlers.onRunComplete?.(data as TeamRunResponse)
        } else if (eventName === "error") {
          const d = data as { code?: string; message?: string; status?: number }
          handlers.onError?.({
            code: d.code,
            message: d.message ?? "Erro no stream",
            status: d.status,
          })
        } else if (eventName === "inboundUserMessage") {
          handlers.onInboundUserMessage?.(data as TeamLiveInboundUserMessage)
        }
      } catch {
        /* chunk invalido */
      }
    })
  }

  async function streamTeamPlanExecute<T>(
    planId: string,
    body: { operationId?: string },
    handlers: ITeamPlanExecuteStreamHandlers<T>,
  ) {
    const baseUrl = getBaseUrl()
    const path = `/team-plans/${planId}/execute/stream`

    const buildHeaders = () => {
      const headers = new Headers({ "Content-Type": "application/json" })
      const { token } = deps.getAuth()
      if (token) headers.set("Authorization", `Bearer ${token}`)
      const wid = deps.getWorkspaceId()
      if (wid) headers.set("X-Workspace-Id", wid)
      return headers
    }

    const doFetch = () =>
      fetch(joinUrl(baseUrl, path), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(body),
      })

    let res = await doFetch()
    if (res.status === 401) {
      const refreshed = await refreshTokenIfPossible()
      if (refreshed) res = await doFetch()
      else deps.clearAuth()
    }

    if (!res.ok) {
      let message = await res.text()
      if (!message) message = res.statusText
      handlers.onError?.({ message, status: res.status })
      return
    }

    await consumeSseResponse(res, (eventName, dataJson) => {
      try {
        const data = JSON.parse(dataJson) as unknown
        if (eventName === "phase") handlers.onPhase?.(data as { phase: any; detail?: string })
        else if (eventName === "complete") handlers.onComplete?.(data as T)
        else if (eventName === "error") {
          const d = data as { code?: string; message?: string; status?: number }
          handlers.onError?.({
            code: d.code,
            message: d.message ?? "Erro no stream",
            status: d.status,
          })
        }
      } catch {
        /* ignore */
      }
    })
  }

  return {
    get: async <T>(path: string, opts?: { tenant?: boolean }) => request<T>(path, { method: "GET", tenant: opts?.tenant }),
    post: async <T>(path: string, body?: unknown, opts?: { tenant?: boolean }) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, tenant: opts?.tenant }),
    put: async <T>(path: string, body?: unknown, opts?: { tenant?: boolean }) =>
      request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, tenant: opts?.tenant }),
    patch: async <T>(path: string, body?: unknown, opts?: { tenant?: boolean }) =>
      request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, tenant: opts?.tenant }),
    del: async <T>(path: string, opts?: { tenant?: boolean }) =>
      request<T>(path, { method: "DELETE", tenant: opts?.tenant }),
    streamTeamRun,
    streamTeamLive,
    streamTeamPlanExecute,
    fetchAuthorized,
  }
}

