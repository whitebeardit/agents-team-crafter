"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
const SPOTLIGHT_PAD = 8
const OVERLAY_Z = 100

function SpotlightMask({ rect, className }: { rect: DOMRect; className?: string }) {
  const pad = SPOTLIGHT_PAD
  const vw = typeof window !== "undefined" ? window.innerWidth : 0
  const vh = typeof window !== "undefined" ? window.innerHeight : 0

  const t = rect.top - pad
  const b = rect.bottom + pad
  const l = rect.left - pad
  const r = rect.right + pad

  const topH = t <= 0 ? 0 : Math.min(t, vh)
  const bottomTop = b >= vh ? vh : Math.max(0, b)
  const bottomH = vh - bottomTop
  const midTop = Math.max(0, t)
  const midBottom = Math.min(vh, b)
  const midH = Math.max(0, midBottom - midTop)
  const leftW = Math.max(0, l)
  const rightLeft = Math.min(vw, r)
  const rightW = vw - rightLeft

  return (
    <div className={cn("pointer-events-none fixed inset-0", className)} style={{ zIndex: OVERLAY_Z }} aria-hidden>
      <div className="pointer-events-auto absolute left-0 right-0 bg-black/55" style={{ top: 0, height: topH }} />
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-black/55" style={{ height: bottomH }} />
      <div
        className="pointer-events-auto absolute bg-black/55"
        style={{ top: midTop, left: 0, width: leftW, height: midH }}
      />
      <div
        className="pointer-events-auto absolute bg-black/55"
        style={{ top: midTop, left: rightLeft, width: rightW, height: midH }}
      />
      <div
        className="pointer-events-none absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-transparent"
        style={{
          top: t,
          left: l,
          width: Math.max(0, r - l),
          height: Math.max(0, b - t),
        }}
      />
    </div>
  )
}

export function useTourAnchorRect(target: HTMLElement | null) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!target || typeof window === "undefined") {
      setRect(null)
      return
    }
    const update = () => {
      setRect(target.getBoundingClientRect())
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(target)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [target])

  return rect
}

type TourSpotlightLayerProps = {
  rect: DOMRect
  title: string
  description: string
  stepLabel: string
  dialogTitle: string
  children: ReactNode
}

/**
 * Camada não-modal: máscara + painel inferior. Clicks na área escurecida ficam bloqueados;
 * o buraco mantém interação com a UI por baixo (pointer-events apenas nas faixas da máscara).
 */
export function TourSpotlightLayer({
  rect,
  title,
  description,
  stepLabel,
  dialogTitle,
  children,
}: TourSpotlightLayerProps) {
  const titleId = useId()
  const metaId = useId()
  const descId = useId()
  if (typeof document === "undefined") return null

  return createPortal(
    <div role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={descId}>
      <SpotlightMask rect={rect} />
      <div
        className="fixed bottom-0 left-0 right-0 max-h-[min(50vh,420px)] overflow-y-auto border-t border-border bg-card p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:max-w-md md:rounded-lg md:border"
        style={{ zIndex: OVERLAY_Z + 1 }}
      >
        <p className="text-xs text-muted-foreground" id={metaId}>
          {dialogTitle} · {stepLabel}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-semibold leading-snug">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
