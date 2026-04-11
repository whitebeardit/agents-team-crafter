import type { TeamPlanPlannerMeta } from "@/lib/types"

export type TPlannerFallbackCopy = {
  /** Uma linha para `toast.warning(title, …)` */
  toastTitle: string
  /** Subtítulo opcional do toast (causa em linguagem clara) */
  toastDescription?: string
  /** Parágrafo(s) para o `Alert` na revisão do plano */
  alertExplanation: string
  /** Trecho técnico (API, Zod, etc.) quando o backend envia `parseErrorSummary` */
  technicalDetail?: string
  /** Código para suporte (`fallbackReason`) */
  reasonCode: string | undefined
}

function trimDetail(s: string | undefined, max = 600): string | undefined {
  if (!s?.trim()) return undefined
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Mensagens PT-BR para quando `plannerMeta.usedFallback` é verdadeiro.
 * Alinhado a `fallbackReason` em `backend/.../team-plan.service.ts`.
 */
export function getPlannerFallbackCopy(meta: TeamPlanPlannerMeta | undefined): TPlannerFallbackCopy {
  const reason = meta?.fallbackReason
  const detail = trimDetail(meta?.parseErrorSummary)

  const baseUnknown: TPlannerFallbackCopy = {
    toastTitle: "Plano gerado em modo template",
    toastDescription: detail
      ? `Motivo nao catalogado. Detalhe: ${detail}`
      : "O servidor nao devolveu um plano valido do modelo; foi usado um esqueleto generico.",
    alertExplanation:
      "A geracao assistida nao produziu um JSON aceite pelo servidor. O plano mostrado e um template para editar manualmente. Confirme integracoes e tente gerar de novo se necessario.",
    technicalDetail: detail,
    reasonCode: reason,
  }

  switch (reason) {
    case "no_openai_key":
      return {
        toastTitle: "Planner sem chave OpenAI",
        toastDescription:
          "Nao ha chave OpenAI configurada para este workspace (nem no servidor). Foi usado um plano em template.",
        alertExplanation:
          "Sem chave OpenAI o sistema nao chama o modelo: o plano exibido e um template generico baseado no seu texto. Configure uma chave em Configuracoes > Integracoes ou OPENAI_API_KEY no backend e gere o plano novamente.",
        technicalDetail: detail,
        reasonCode: reason,
      }
    case "openai_request_failed":
      return {
        toastTitle: "Falha na chamada ao modelo (OpenAI)",
        toastDescription: detail
          ? `Erro reportado: ${detail}`
          : "A API OpenAI nao respondeu com sucesso (rede, quota, chave invalida, etc.).",
        alertExplanation:
          "A chamada ao modelo falhou antes de obter um plano valido. Verifique quota, validade da chave e conectividade. O plano actual e um template; pode editar ou tentar gerar de novo.",
        technicalDetail: detail,
        reasonCode: reason,
      }
    case "json_extract_failed":
      return {
        toastTitle: "Resposta do modelo sem JSON utilizavel",
        toastDescription: detail || "Nao foi possivel extrair um objeto JSON da resposta.",
        alertExplanation:
          "O modelo devolveu texto que nao continha um JSON reconhecivel pelo servidor (por exemplo so markdown ou texto livre). O plano mostrado e fallback. Tente reformular o problema/contexto ou gerar novamente.",
        technicalDetail: detail,
        reasonCode: reason,
      }
    case "schema_validation_failed":
      return {
        toastTitle: "JSON do modelo invalido para o planner",
        toastDescription: detail
          ? `Validacao: ${detail}`
          : "O JSON devolvido nao cumpre o formato esperado pelo servidor.",
        alertExplanation:
          "O modelo devolveu JSON, mas a estrutura nao passou na validacao do servidor (campos em falta ou tipos errados). O plano actual e template. Ajuste o pedido ou tente outra vez.",
        technicalDetail: detail,
        reasonCode: reason,
      }
    default:
      if (typeof reason === "string" && reason.length > 0) {
        return {
          ...baseUnknown,
          toastDescription: `Codigo: ${reason}${detail ? ` — ${detail}` : ""}`,
          alertExplanation: `${baseUnknown.alertExplanation} Codigo reportado: ${reason}.`,
          reasonCode: reason,
        }
      }
      return baseUnknown
  }
}
