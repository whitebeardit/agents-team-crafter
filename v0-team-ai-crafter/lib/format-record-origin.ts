import type { RecordOrigin } from "@/lib/types"

export function formatRecordOrigin(origin: RecordOrigin | undefined): string {
  if (!origin) return "Origem: —"
  return `Origem: ${origin.type} · ${origin.slug} · ${origin.id}`
}

