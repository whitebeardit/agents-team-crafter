"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Expand, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface ImagePreviewItem {
  src: string
  alt?: string
  filename?: string
}

interface ImagePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ImagePreviewItem[]
  initialIndex?: number
  onDownload?: (item: ImagePreviewItem) => void | Promise<void>
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
  onDownload,
}: ImagePreviewDialogProps) {
  const [offset, setOffset] = useState(0)
  const total = items.length
  const normalizedInitial = Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0))
  const safeIndex = total > 0 ? (normalizedInitial + offset + total) % total : 0
  const current = items[safeIndex]

  useEffect(() => {
    if (!open || total <= 1) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setOffset((prev) => (prev - 1 + total) % total)
      if (e.key === "ArrowRight") setOffset((prev) => (prev + 1) % total)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, total])

  const title = useMemo(() => {
    if (!current) return "Pré-visualização"
    return current.filename ?? `Imagem ${safeIndex + 1}`
  }, [current, safeIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-3">
        <DialogHeader className="flex-row items-center justify-between space-y-0 gap-2 pr-8">
          <DialogTitle className="text-sm truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-muted/40 rounded-md p-2 min-h-[40vh] flex items-center justify-center">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={current.alt ?? current.filename ?? "Imagem"}
              className="max-h-[75vh] max-w-full object-contain rounded"
              loading="lazy"
            />
          ) : null}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {current && onDownload ? (
              <Button size="icon" variant="secondary" onClick={() => void onDownload(current)} aria-label="Download da imagem">
                <Download className="w-4 h-4" />
              </Button>
            ) : null}
            <Button size="icon" variant="secondary" onClick={() => onOpenChange(false)} aria-label="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {total > 1 ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setOffset((prev) => (prev - 1 + total) % total)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {safeIndex + 1} / {total}
            </span>
            <Button variant="outline" onClick={() => setOffset((prev) => (prev + 1) % total)}>
              Próxima
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function ImagePreviewTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="icon" onClick={onClick} aria-label="Expandir imagem">
      <Expand className="w-4 h-4" />
    </Button>
  )
}
