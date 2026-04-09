import type { GovernanceAuditEvent } from "@/lib/types"

/** Campo CSV com escape RFC 4180 (Excel-friendly). */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function governanceAuditEventsToCsv(rows: GovernanceAuditEvent[]): string {
  const header = ["id", "eventType", "createdAt", "userId", "correlationId", "payload"]
  const lines: string[] = [header.join(",")]
  for (const ev of rows) {
    const payload = JSON.stringify(ev.payload ?? {})
    lines.push(
      [
        escapeCsvField(ev.id ?? ""),
        escapeCsvField(ev.eventType ?? ""),
        escapeCsvField(ev.createdAt ?? ""),
        escapeCsvField(ev.userId ?? ""),
        escapeCsvField(ev.correlationId ?? ""),
        escapeCsvField(payload),
      ].join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function triggerTextDownload(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
