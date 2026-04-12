import type { TeamRunExecutionEvent, TeamRunSpecialistResult } from "@/lib/types"

export type TeamDebugNarrativeLine = { kind: "step" | "summary"; text: string }

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function labelForAgent(agentId: string | undefined, names: Record<string, string>): string {
  if (!agentId) return "Agente"
  return names[agentId] ?? `${agentId.slice(0, 8)}…`
}

/**
 * Converte eventos da última run e resumos de especialistas em linhas legíveis (PT),
 * sem depender de JSON bruto.
 */
export function buildTeamRunNarrativeLines(
  events: TeamRunExecutionEvent[],
  specialistResults: TeamRunSpecialistResult[],
  agentDisplayNames: Record<string, string>,
): TeamDebugNarrativeLine[] {
  const lines: TeamDebugNarrativeLine[] = []

  for (const ev of events) {
    switch (ev.type) {
      case "coordinatorStarted":
        lines.push({
          kind: "step",
          text: `${labelForAgent(ev.agentId, agentDisplayNames)} (coordenador) iniciou o processamento.`,
        })
        break
      case "coordinatorFinished":
        lines.push({
          kind: "step",
          text: "Coordenador concluiu — resposta pronta para o utilizador.",
        })
        break
      case "taskType":
        if (ev.value?.trim()) {
          lines.push({ kind: "step", text: `Tipo de tarefa: ${ev.value.trim()}.` })
        }
        break
      case "toolResult": {
        const tool = ev.tool?.trim()
        const ok = ev.status === "success"
        const err = ev.errorCode ? ` (${ev.errorCode})` : ""
        lines.push({
          kind: "step",
          text: tool
            ? `Tool \`${tool}\`: ${ok ? "concluída" : "falhou"}${err}.`
            : `Resultado de tool: ${ok ? "ok" : "falhou"}${err}.`,
        })
        break
      }
      case "specialistStarted":
        lines.push({
          kind: "step",
          text: `${labelForAgent(ev.agentId, agentDisplayNames)} — execução do especialista (${ev.phase ?? "runStep"})${
            ev.detail ? `: ${truncate(ev.detail, 180)}` : "."
          }`,
        })
        break
      case "specialistFinished":
        lines.push({
          kind: "step",
          text: `${labelForAgent(ev.agentId, agentDisplayNames)} concluiu${
            ev.detail ? `: ${truncate(ev.detail, 220)}` : "."
          }`,
        })
        break
      default:
        if (ev.type && ev.type !== "coordinatorStarted" && ev.type !== "coordinatorFinished") {
          const bits = [ev.type]
          if (ev.detail) bits.push(truncate(ev.detail, 160))
          lines.push({ kind: "step", text: bits.join(" — ") })
        }
        break
    }
  }

  const seen = new Set<string>()
  for (const sr of specialistResults) {
    const sum = sr.summary?.replace(/\s+/g, " ").trim()
    if (!sum) continue
    const key = `${sr.specialistAgentId}:${sum.slice(0, 120)}`
    if (seen.has(key)) continue
    seen.add(key)
    const label = labelForAgent(sr.specialistAgentId, agentDisplayNames)
    lines.push({
      kind: "summary",
      text: `Resumo (${label}): ${truncate(sum, 360)}`,
    })
  }

  return lines
}
