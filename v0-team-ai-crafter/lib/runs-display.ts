import type { TeamRunRecord } from "@/lib/types"

export function teamRunStatusLabel(status: TeamRunRecord["status"]): string {
  switch (status) {
    case "completed":
      return "Concluída"
    case "failed":
      return "Falhou"
    case "running":
      return "Em execução"
    default:
      return status
  }
}

export function teamRunSourceLabel(source: TeamRunRecord["source"]): string {
  switch (source) {
    case "manual":
      return "Consola / HTTP"
    case "inbound":
      return "Canal (inbound)"
    case "planner":
      return "Planner IA"
    default:
      return source
  }
}

/** Rótulo curto para o campo `trigger` persistido no run. */
export function teamRunTriggerLabel(trigger: string): string {
  const m: Record<string, string> = {
    manual_http: "Pedido HTTP manual",
    manual_stream: "Stream SSE (manual)",
    channel_inbound: "Mensagem no canal",
    manual: "Manual",
    chat: "Chat",
  }
  return m[trigger] ?? trigger
}

export function formatRunDurationMs(startedAt: string, finishedAt?: string | null): string | null {
  if (!finishedAt) return null
  const a = new Date(startedAt).getTime()
  const b = new Date(finishedAt).getTime()
  const d = b - a
  if (!Number.isFinite(d) || d < 0) return null
  if (d < 1000) return `${Math.round(d)} ms`
  return `${(d / 1000).toFixed(1)} s`
}

export function runStepTypeLabel(stepType: string): string {
  const m: Record<string, string> = {
    specialist: "Especialista",
    coordinator: "Coordenador",
    tool: "Tool",
    taskType: "Tarefa",
  }
  return m[stepType] ?? stepType
}
