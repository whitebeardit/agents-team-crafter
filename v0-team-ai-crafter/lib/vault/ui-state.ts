/**
 * Contrato UX comum para second-brain: deep links e mensagens de estado vazio
 * entre `/agents/:id` (escopo agente) e `/settings?tab=workspace` (escopo workspace).
 */

/** Query params canónicos para navegação cruzada second-brain */
export const VAULT_DEEP_LINK = {
  settingsTab: "tab",
  vaultNote: "vaultNote",
  vaultParty: "vaultParty",
  vaultAgent: "vaultAgent",
  agentVaultTab: "vaultTab",
} as const

export type TVaultNotesEmptyCause =
  | "ok"
  | "forbidden"
  | "network"
  | "empty_after_load"

/**
 * Link para Configurações → Workspace com filtros opcionais na Memória do time.
 */
export function buildWorkspaceSecondBrainHref(input: {
  vaultParty?: string
  vaultAgent?: string
  vaultNote?: string
}): string {
  const q = new URLSearchParams()
  q.set(VAULT_DEEP_LINK.settingsTab, "workspace")
  const party = input.vaultParty?.trim()
  const agent = input.vaultAgent?.trim()
  const note = input.vaultNote?.trim()
  if (party) q.set(VAULT_DEEP_LINK.vaultParty, party)
  if (agent) q.set(VAULT_DEEP_LINK.vaultAgent, agent)
  if (note) q.set(VAULT_DEEP_LINK.vaultNote, note)
  return `/settings?${q.toString()}`
}

/**
 * Link para a aba Second-brain do agente, com filtros opcionais.
 */
export function buildAgentSecondBrainHref(
  agentId: string,
  input?: { vaultParty?: string; vaultNote?: string },
): string {
  const q = new URLSearchParams()
  q.set(VAULT_DEEP_LINK.agentVaultTab, "vault")
  const party = input?.vaultParty?.trim()
  const note = input?.vaultNote?.trim()
  if (party) q.set(VAULT_DEEP_LINK.vaultParty, party)
  if (note) q.set(VAULT_DEEP_LINK.vaultNote, note)
  return `/agents/${encodeURIComponent(agentId)}?${q.toString()}`
}

export type TVaultEmptyCopy = {
  title: string
  lines: string[]
}

/**
 * Mensagens de lista vazia orientadas à causa (sem atrelar listagem a `usePersistentMemory`).
 */
export function vaultNotesEmptyCopy(
  scope: "agent" | "workspace",
  cause: Exclude<TVaultNotesEmptyCause, "ok">,
  opts?: { hasPartyFilter?: boolean },
): TVaultEmptyCopy {
  if (cause === "forbidden") {
    return {
      title: "Sem permissão",
      lines: [
        "Não foi possível listar as notas do vault com a sua sessão actual.",
        scope === "agent"
          ? "Peça a um administrador do workspace para validar permissões ou abra a visão global em Configurações → Workspace."
          : "Confirme que tem permissões de administrador do workspace, se aplicável.",
      ],
    }
  }
  if (cause === "network") {
    return {
      title: "Falha ao carregar",
      lines: [
        "Não foi possível obter as notas. Verifique a rede e tente novamente.",
        "Se o problema persistir, use «Atualizar lista» / «Carregar» ou reindexe o vault em Configurações → Workspace.",
      ],
    }
  }
  // empty_after_load
  if (scope === "agent") {
    const lines = [
      opts?.hasPartyFilter
        ? "Nenhuma nota encontrada para este agente com o cliente (party) seleccionado."
        : "Nenhuma nota encontrada para este agente com os filtros actuais.",
      "Propostas automáticas aparecem após conversas com o time (estado «proposed» até revisão humana).",
      "A memória persistente (Conhecimento) controla a injecção de aprendizados aprovados no prompt do especialista; não bloqueia esta listagem.",
    ]
    return { title: "Sem notas", lines }
  }
  return {
    title: "Sem notas",
    lines: [
      "Nenhuma nota encontrada para os filtros actuais (time, agente ou cliente).",
      "Ajuste os filtros ou clique em «Carregar». Em workspaces novos ainda não há aprendizados persistidos.",
      "Use «Reindexar» se alterou ficheiros do vault no servidor e o índice estiver desactualizado.",
    ],
  }
}
