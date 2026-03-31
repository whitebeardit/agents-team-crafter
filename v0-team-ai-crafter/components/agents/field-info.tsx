"use client"

import type { ReactNode } from "react"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FieldInfoProps = {
  /** Rótulo para leitores de tela (ex.: "Ajuda sobre descrição do agente") */
  ariaLabel: string
  children: ReactNode
  className?: string
  align?: "start" | "center" | "end"
}

/** Botão de ajuda com Popover; use ao lado de Labels e títulos de seção. */
export function FieldInfo({ ariaLabel, children, className, align = "start" }: FieldInfoProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground", className)}
          aria-label={ariaLabel}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,20rem)] max-w-sm text-sm" align={align}>
        <div className="space-y-2 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}

type LabelWithInfoProps = {
  htmlFor?: string
  className?: string
  labelText: string
  infoAriaLabel: string
  children: ReactNode
}

/** Label + FieldInfo na mesma linha. */
export function LabelWithInfo({ htmlFor, className, labelText, infoAriaLabel, children }: LabelWithInfoProps) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor} className={className}>
        {labelText}
      </Label>
      <FieldInfo ariaLabel={infoAriaLabel}>{children}</FieldInfo>
    </div>
  )
}

type CardTitleWithInfoProps = {
  title: string
  infoAriaLabel: string
  children: ReactNode
  className?: string
}

/** CardTitle com ícone de ajuda (mantém heading semântico via CardTitle). */
export function CardTitleWithInfo({ title, infoAriaLabel, children, className }: CardTitleWithInfoProps) {
  return (
    <CardTitle className={cn("flex flex-wrap items-center gap-1", className)}>
      <span>{title}</span>
      <FieldInfo ariaLabel={infoAriaLabel}>{children}</FieldInfo>
    </CardTitle>
  )
}
