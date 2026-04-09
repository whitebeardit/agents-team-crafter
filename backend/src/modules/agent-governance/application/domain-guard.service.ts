import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import type {
  IAgentGovernanceDraft,
  IAgentOverlapMatch,
  IAgentOverlapReview,
  TOverlapClassification,
  TOverlapDecision,
} from '../domain/agent-governance.types.js';

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function tokenizeText(value: string | undefined): string[] {
  if (!value) return [];
  return uniqueNormalized(
    value
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/),
  );
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let intersection = 0;
  for (const item of sa) if (sb.has(item)) intersection += 1;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

function buildFingerprint(draft: IAgentGovernanceDraft): {
  category: string;
  skills: string[];
  responsibilities: string[];
  keywords: string[];
  text: string[];
} {
  const domain = draft.domain ?? {};
  return {
    category: normalizeAgentCategory(draft.category ?? 'geral'),
    skills: uniqueNormalized(draft.skills ?? []),
    responsibilities: uniqueNormalized([...(draft.responsibilities ?? []), ...(domain.boundaries ?? [])]),
    keywords: uniqueNormalized([...(domain.keywords ?? []), ...(domain.exclusions ?? []), ...(draft.reuseHints ?? [])]),
    text: uniqueNormalized([
      ...tokenizeText(draft.name),
      ...tokenizeText(draft.description),
      ...tokenizeText(draft.goal),
      ...tokenizeText(domain.summary),
      ...tokenizeText(domain.inputDescription),
      ...tokenizeText(domain.outputDescription),
    ]),
  };
}

function classifyScore(score: number): TOverlapClassification {
  if (score >= 0.78) return 'conflict';
  if (score >= 0.48) return 'warning';
  return 'safe';
}

function reasonFromOverlap(
  existingName: string,
  sharedKeywords: string[],
  sharedResponsibilities: string[],
  score: number,
): string {
  if (sharedKeywords.length > 0) {
    return `Sobreposicao com "${existingName}" em palavras-chave: ${sharedKeywords.slice(0, 5).join(', ')} (score ${score.toFixed(2)}).`;
  }
  if (sharedResponsibilities.length > 0) {
    return `Sobreposicao com "${existingName}" em responsabilidades: ${sharedResponsibilities.slice(0, 3).join(', ')} (score ${score.toFixed(2)}).`;
  }
  return `Escopo muito proximo de "${existingName}" (score ${score.toFixed(2)}).`;
}

export class DomainGuardService {
  constructor(private readonly agentRepo: AgentRepository) {}

  async review(workspaceId: string, draft: IAgentGovernanceDraft): Promise<IAgentOverlapReview> {
    const agents = await this.agentRepo.listByWorkspace(workspaceId);
    const base = buildFingerprint(draft);

    const matches: IAgentOverlapMatch[] = agents
      .filter((agent) => agent.id !== draft.id)
      .map((agent) => {
        const current = buildFingerprint({
          id: agent.id ?? undefined,
          name: agent.name,
          description: agent.description ?? undefined,
          role: agent.role,
          category: agent.category,
          skills: agent.skills,
          goal: agent.goal ?? undefined,
          responsibilities: agent.responsibilities,
          domain: agent.domain ?? undefined,
          qualityCriteria: agent.qualityCriteria,
          reuseHints: agent.reuseHints,
          platformManaged: agent.platformManaged,
          systemRole: agent.systemRole,
        });
        const categoryScore = base.category === current.category ? 1 : 0;
        const skillScore = jaccard(base.skills, current.skills);
        const respScore = jaccard(base.responsibilities, current.responsibilities);
        const keywordScore = jaccard(base.keywords, current.keywords);
        const textScore = jaccard(base.text, current.text);
        const sameRoleBoost = draft.role === agent.role ? 0.08 : 0;
        const score = Math.min(
          1,
          categoryScore * 0.24 + skillScore * 0.22 + respScore * 0.22 + keywordScore * 0.18 + textScore * 0.14 + sameRoleBoost,
        );
        const classification = classifyScore(score);
        const sharedKeywords = base.keywords.filter((item) => current.keywords.includes(item));
        const sharedResponsibilities = base.responsibilities.filter((item) => current.responsibilities.includes(item));
        return {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          score: Number(score.toFixed(4)),
          classification,
          reason: reasonFromOverlap(agent.name, sharedKeywords, sharedResponsibilities, score),
          recommendation:
            classification === 'conflict'
              ? 'reuse_existing'
              : classification === 'warning'
                ? 'refine_scope'
                : 'safe_to_create',
        } satisfies IAgentOverlapMatch;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const top = matches[0];
    let decision: TOverlapDecision = 'allow';
    let summary = 'Nenhuma sobreposicao relevante encontrada.';

    if (top?.classification === 'conflict') {
      decision = top.score >= 0.88 ? 'reuse_existing' : 'block';
      summary =
        decision === 'reuse_existing'
          ? `Existe um agente fortemente equivalente no workspace: "${top.agentName}".`
          : `O draft conflita com "${top.agentName}" e deve ser refinado antes de criar outro especialista.`;
    } else if (top?.classification === 'warning') {
      decision = 'review';
      summary = `O draft tem proximidade com "${top.agentName}" e precisa validar limites de dominio antes de seguir.`;
    }

    return {
      workspaceId,
      draftAgent: {
        ...draft,
        category: normalizeAgentCategory(draft.category ?? 'geral'),
      },
      matches,
      decision,
      summary,
    };
  }
}
