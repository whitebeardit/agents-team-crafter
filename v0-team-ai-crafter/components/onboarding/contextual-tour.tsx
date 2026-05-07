"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CircleHelp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createApiClient } from "@/lib/api/client"
import type { User } from "@/lib/types"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { CONTEXTUAL_TOUR_CATALOG } from "@/lib/contextual-tours-catalog"
import type { ContextualTourScreenKey } from "@/lib/contextual-tours"
import {
  getSeenTourVersion,
  mergeTourSeenVersion,
  resolveContextualTourAnchor,
  snoozeSessionKey,
} from "@/lib/contextual-tours"
import {
  TourSpotlightLayer,
  useTourAnchorRect,
} from "@/components/onboarding/tour-spotlight-overlay"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const manualOpenRegistry = new Map<ContextualTourScreenKey, () => void>()

export function openContextualTourManually(screenKey: ContextualTourScreenKey) {
  manualOpenRegistry.get(screenKey)?.()
}

type ContextualTourHostProps = {
  screenKey: ContextualTourScreenKey
  /** Auto-abrir no primeiro acesso quando a versão do catálogo for superior à gravada */
  autoStart?: boolean
}

export function ContextualTourHost({ screenKey, autoStart = true }: ContextualTourHostProps) {
  const def = CONTEXTUAL_TOUR_CATALOG[screenKey]
  const { user, currentWorkspace, token, refreshToken, refreshSessionUser } = useWorkspaceStore()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  /** Evita snooze ao fechar depois de persistir (Concluir / Não mostrar) */
  const closedAfterPersistRef = useRef(false)

  const wsId = currentWorkspace?.id
  const prefs = user?.preferences as Record<string, unknown> | undefined
  const seenVersion = useMemo(() => getSeenTourVersion(prefs, wsId, screenKey), [prefs, wsId, screenKey])

  const openFromStart = useCallback(() => {
    setStepIndex(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    manualOpenRegistry.set(screenKey, openFromStart)
    return () => {
      manualOpenRegistry.delete(screenKey)
    }
  }, [screenKey, openFromStart])

  useEffect(() => {
    if (!autoStart || !wsId || !user || typeof window === "undefined") return
    if (sessionStorage.getItem(snoozeSessionKey(wsId, screenKey))) return
    if (seenVersion >= def.version) return
    const t = window.setTimeout(() => {
      setStepIndex(0)
      setOpen(true)
    }, 500)
    return () => window.clearTimeout(t)
  }, [autoStart, wsId, user, screenKey, seenVersion, def.version])

  const persistSeen = useCallback(async () => {
    if (!token || !user || !wsId) return
    setSaving(true)
    const nextPrefs = mergeTourSeenVersion(prefs, wsId, screenKey, def.version)
    /** Patch mínimo: o BFF faz merge profundo em `contextualTours.byWorkspace`. */
    const preferencesPatch: Record<string, unknown> = {
      contextualTours: {
        byWorkspace: {
          [wsId]: { [screenKey]: def.version },
        },
      },
    }
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: (auth) =>
          useWorkspaceStore.setState({
            token: auth.token,
            refreshToken: auth.refreshToken ?? refreshToken,
          }),
        clearAuth: () => {},
        getWorkspaceId: () => wsId,
      })
      await api.put("/settings/profile", { preferences: preferencesPatch }, { tenant: false })
      useWorkspaceStore.setState((s) =>
        s.user ? { user: { ...s.user, preferences: nextPrefs as User["preferences"] } } : {},
      )
      try {
        await refreshSessionUser()
      } catch {
        /* preferência já persistida; falha ao re-sincronizar /auth/me */
      }
    } catch {
      toast.error("Não foi possível gravar a preferência do tour")
    } finally {
      setSaving(false)
    }
  }, [token, refreshToken, user, wsId, prefs, screenKey, def.version, refreshSessionUser])

  const handleLater = () => {
    if (wsId && typeof window !== "undefined") {
      sessionStorage.setItem(snoozeSessionKey(wsId, screenKey), "1")
    }
    closedAfterPersistRef.current = true
    setOpen(false)
  }

  const handleDismissForever = async () => {
    await persistSeen()
    closedAfterPersistRef.current = true
    setOpen(false)
  }

  const handleFinish = async () => {
    await persistSeen()
    closedAfterPersistRef.current = true
    setOpen(false)
  }

  const lastStep = stepIndex >= def.steps.length - 1
  const step = def.steps[stepIndex]

  /** Re-renderiza enquanto o DOM do ancoragem pode aparecer tarde (ex.: dados async). */
  const [anchorPollTick, setAnchorPollTick] = useState(0)
  useEffect(() => {
    if (!open || !step?.anchor) return
    if (typeof document === "undefined") return
    if (resolveContextualTourAnchor(step.anchor)) return
    let n = 0
    const id = window.setInterval(() => {
      setAnchorPollTick((t) => t + 1)
      n += 1
      if (n >= 20) window.clearInterval(id)
    }, 48)
    return () => window.clearInterval(id)
  }, [open, stepIndex, step?.anchor])

  const anchorEl = (() => {
    if (!open || !step?.anchor || typeof document === "undefined") return null
    return resolveContextualTourAnchor(step.anchor)
  })()

  const anchorRect = useTourAnchorRect(anchorEl)
  const spotlightMode = Boolean(step?.anchor && anchorEl && anchorRect)
  const dialogOpen = open && !spotlightMode

  useEffect(() => {
    if (!open || !spotlightMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (wsId && typeof window !== "undefined") {
        sessionStorage.setItem(snoozeSessionKey(wsId, screenKey), "1")
      }
      closedAfterPersistRef.current = true
      setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, spotlightMode, wsId, screenKey])

  const stepLabel = `Passo ${stepIndex + 1} de ${def.steps.length}`
  const footerNav = (
    <>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Button type="button" variant="ghost" size="sm" onClick={handleLater} disabled={saving}>
          Mais tarde
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDismissForever} disabled={saving}>
          Não mostrar de novo
        </Button>
      </div>
      <div className="flex w-full justify-end gap-2 sm:w-auto">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={saving}
          >
            Anterior
          </Button>
        ) : null}
        {lastStep ? (
          <Button type="button" size="sm" onClick={() => void handleFinish()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Concluir"}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => setStepIndex((i) => i + 1)} disabled={saving}>
            Seguinte
          </Button>
        )}
      </div>
    </>
  )

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            if (!closedAfterPersistRef.current && wsId && typeof window !== "undefined") {
              sessionStorage.setItem(snoozeSessionKey(wsId, screenKey), "1")
            }
            closedAfterPersistRef.current = false
          }
          setOpen(o)
        }}
      >
        <DialogContent className="max-h-[min(90vh,560px)] gap-0 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{def.dialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {stepLabel}. Use os botões para navegar ou concluir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-xs text-muted-foreground">{stepLabel}</p>
            {step ? (
              <>
                <h3 className="text-base font-semibold leading-snug">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">{footerNav}</DialogFooter>
        </DialogContent>
      </Dialog>
      {open && spotlightMode && anchorRect && step ? (
        <TourSpotlightLayer
          rect={anchorRect}
          title={step.title}
          description={step.description}
          stepLabel={stepLabel}
          dialogTitle={def.dialogTitle}
        >
          {footerNav}
        </TourSpotlightLayer>
      ) : null}
    </>
  )
}

type ContextualTourManualTriggerProps = {
  screenKey: ContextualTourScreenKey
  className?: string
  label?: string
}

export function ContextualTourManualTrigger({
  screenKey,
  className,
  label = "Ver tour desta tela",
}: ContextualTourManualTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0 gap-1.5", className)}
      onClick={() => openContextualTourManually(screenKey)}
    >
      <CircleHelp className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  )
}
