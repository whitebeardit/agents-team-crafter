import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Evita overflow horizontal em `<Table>` em viewports estreitas (Loops 66 e 71). */
export function ResponsiveTableScroll({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-x-auto rounded-md [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {children}
    </div>
  )
}
