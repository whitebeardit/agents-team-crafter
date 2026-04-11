/**
 * Loop 67 — tours contextuais por ecrã.
 * Persistência: `user.preferences.contextualTours.byWorkspace[workspaceId][screenKey] = seenVersion`
 * (merge via PUT /settings/profile).
 */

export type ContextualTourScreenKey =
  | "dashboard"
  | "ai_builder"
  | "tool_definitions"
  | "settings"
  | "channels"
  | "schedule"
  | "agents_catalog"
  | "teams_list"
  | "runs_list"
  | "templates_catalog"
  | "governance_workspace"
  | "observability_metrics"
  | "agent_detail"
  | "team_detail"

export interface IContextualToursPreferences {
  /** Por workspace: por chave de ecrã, última versão do conteúdo vista/concluída */
  byWorkspace?: Record<string, Partial<Record<ContextualTourScreenKey, number>>>
}

/** Ancoragem DOM opcional por passo (Loop 72). Preferir `dataAttr` com `data-tour-anchor` estável na UI. */
export type ContextualTourAnchor =
  | { kind: "dataAttr"; value: string }
  | { kind: "selector"; value: string }

export type ContextualTourStep = {
  title: string
  description: string
  /** Se definido, o passo pode renderizar em modo spotlight quando o alvo existir no DOM. */
  anchor?: ContextualTourAnchor
}

/**
 * Resolve o elemento alvo do passo. Em ambiente sem `document`, devolve sempre `null`.
 */
export function resolveContextualTourAnchor(anchor: ContextualTourAnchor): HTMLElement | null {
  if (typeof document === "undefined") return null
  if (anchor.kind === "dataAttr") {
    try {
      return document.querySelector(`[data-tour-anchor="${CSS.escape(anchor.value)}"]`)
    } catch {
      return null
    }
  }
  try {
    return document.querySelector(anchor.value)
  } catch {
    return null
  }
}

export type ContextualTourDefinition = {
  /** Versão semântica do conteúdo deste tour; ao subir, o auto-tour volta a aparecer */
  version: number
  dialogTitle: string
  steps: ContextualTourStep[]
}

export function getSeenTourVersion(
  preferences: Record<string, unknown> | undefined,
  workspaceId: string | undefined,
  screenKey: ContextualTourScreenKey,
): number {
  if (!preferences || !workspaceId) return 0
  const ct = preferences.contextualTours as IContextualToursPreferences | undefined
  const v = ct?.byWorkspace?.[workspaceId]?.[screenKey]
  return typeof v === "number" ? v : 0
}

/** Merge profundo só do ramo contextualTours; usar com preferences atuais do utilizador */
export function mergeTourSeenVersion(
  preferences: Record<string, unknown> | undefined,
  workspaceId: string,
  screenKey: ContextualTourScreenKey,
  version: number,
): Record<string, unknown> {
  const prev = { ...(preferences ?? {}) }
  const prevCt = (prev.contextualTours as IContextualToursPreferences | undefined) ?? {}
  const prevByWs = { ...(prevCt.byWorkspace ?? {}) }
  const prevWs = { ...(prevByWs[workspaceId] ?? {}) }
  prevWs[screenKey] = version
  prevByWs[workspaceId] = prevWs
  return {
    ...prev,
    contextualTours: {
      ...prevCt,
      byWorkspace: prevByWs,
    },
  }
}

export function snoozeSessionKey(workspaceId: string, screenKey: ContextualTourScreenKey): string {
  return `ctxTourSnooze:${workspaceId}:${screenKey}`
}
