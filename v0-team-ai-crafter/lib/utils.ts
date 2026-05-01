import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Escolhe o texto mais longo (após trim) para não substituir stream por resposta final truncada. */
export function pickLongestTrimmed(a: string | undefined | null, b: string | undefined | null): string {
  const ta = (a ?? "").trim()
  const tb = (b ?? "").trim()
  if (tb.length > ta.length) return tb.length > 0 ? tb : ta
  return ta.length > 0 ? ta : tb
}
