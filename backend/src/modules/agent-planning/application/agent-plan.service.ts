import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { IAppDeps } from '../../../config/container.js';
import type { AgentPlanRepository } from '../infra/agent-plan.repository.js';
import type { IAgentGovernanceDraft } from '../../agent-governance/domain/agent-governance.types.js';
import { getWorkspaceOverlapMode } from '../../governance/application/workspace-overlap-mode.js';

export class AgentPlanService {
  constructor(
    private readonly deps: IAppDeps,
    private readonly repo: AgentPlanRepository,
  ) {}

  private buildDraft(input: {
    objective: string;
    context?: string;
    expectedOutcome?: string;
    role?: 'coordinator' | 'specialist';
    category?: string;
    skills?: string[];
    boundaries?: string[];
    exclusions?: string[];
  }): IAgentGovernanceDraft {
    const role = input.role ?? 'specialist';
    const category = normalizeAgentCategory(input.category ?? 'geral');
    const objective = input.objective.trim();
    const baseName =
      role === 'coordinator'
        ? `Coordenador ${category}`
        : `${category.replace(/(^\w)/, (m) => m.toUpperCase())} Specialist`;
    return {
      name: baseName,
      description: input.context?.trim() || objective,
      role,
      category,
      skills: input.skills ?? [],
      goal: input.expectedOutcome?.trim() || objective,
      responsibilities: [
        `Atuar no dominio de ${category}`,
        `Entregar: ${input.expectedOutcome?.trim() || objective}`,
      ],
      domain: {
        summary: objective,
        keywords: [category, ...(input.skills ?? [])],
        inputDescription: input.context?.trim() || objective,
        outputDescription: input.expectedOutcome?.trim() || 'Resposta clara e acionavel',
        boundaries: input.boundaries ?? [],
        exclusions: input.exclusions ?? [],
      },
      qualityCriteria: ['Escopo bem delimitado', 'Saida objetiva', 'Baixo overlap com especialistas existentes'],
      reuseHints: input.skills ?? [],
      platformManaged: false,
      systemRole: null,
    };
  }

  private mapOverlapReviewToPlanDecision(
    review: Awaited<ReturnType<typeof this.deps.domainGuardService.review>>,
  ) {
    if (review.decision === 'reuse_existing') return 'reuse_existing' as const;
    if (review.decision === 'block') return 'blocked' as const;
    if (review.decision === 'review') return 'split_scope' as const;
    return 'create_new' as const;
  }

  async createPlan(
    workspaceId: string,
    input: {
      objective: string;
      context?: string;
      expectedOutcome?: string;
      role?: 'coordinator' | 'specialist';
      category?: string;
      skills?: string[];
      boundaries?: string[];
      exclusions?: string[];
    },
  ) {
    const draftAgent = this.buildDraft(input);
    const overlapReview = await this.deps.domainGuardService.review(workspaceId, draftAgent);
    const decision = this.mapOverlapReviewToPlanDecision(overlapReview);
    const notes = [
      overlapReview.summary,
      decision === 'reuse_existing'
        ? 'O wizard recomenda reutilizar um agente existente do workspace.'
        : decision === 'split_scope'
          ? 'O wizard recomenda ajustar fronteiras antes de executar.'
          : decision === 'blocked'
            ? 'O wizard bloqueou a criacao ate eliminar a sobreposicao.'
            : 'O draft pode ser executado para criar um novo agente.',
    ];
    return this.repo.create(workspaceId, {
      status: decision === 'blocked' ? 'blocked' : 'ready',
      request: input,
      draftAgent,
      overlapReview,
      decision,
      notes,
    });
  }

  async updatePlan(
    workspaceId: string,
    id: string,
    patch: {
      draftAgent?: IAgentGovernanceDraft;
      request?: Record<string, unknown>;
    },
  ) {
    const current = await this.repo.findById(workspaceId, id);
    if (!current) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
    if (current.status === 'executed') {
      throw new AppError('CONFLICT', 'Plano ja foi executado', 409);
    }
    const draftAgent = (patch.draftAgent ?? current.draftAgent) as IAgentGovernanceDraft;
    const overlapReview = await this.deps.domainGuardService.review(workspaceId, draftAgent);
    const decision = this.mapOverlapReviewToPlanDecision(overlapReview);
    const updated = await this.repo.update(workspaceId, id, {
      request: patch.request ?? current.request,
      draftAgent,
      overlapReview,
      decision,
      status: decision === 'blocked' ? 'blocked' : 'ready',
      notes: [
        overlapReview.summary,
        decision === 'reuse_existing'
          ? 'O wizard recomenda reutilizar um agente existente do workspace.'
          : decision === 'split_scope'
            ? 'O wizard recomenda ajustar fronteiras antes de executar.'
            : decision === 'blocked'
              ? 'O wizard bloqueou a criacao ate eliminar a sobreposicao.'
              : 'O draft pode ser executado para criar um novo agente.',
      ],
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
    return updated;
  }

  async executePlan(
    workspaceId: string,
    id: string,
    opts?: { actorUserId?: string; correlationId?: string },
  ): Promise<{ plan: NonNullable<Awaited<ReturnType<AgentPlanRepository['findById']>>>; responseMeta: Record<string, unknown> }> {
    const plan = await this.repo.findById(workspaceId, id);
    if (!plan) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
    if (plan.status === 'executed' && plan.result) {
      return { plan, responseMeta: {} };
    }

    const overlapMode = await getWorkspaceOverlapMode(this.deps, workspaceId);
    const responseMeta: Record<string, unknown> = {};

    if (plan.decision === 'blocked') {
      if (overlapMode === 'blocking') {
        await this.deps.governanceAuditRepo.append({
          workspaceId,
          userId: opts?.actorUserId,
          correlationId: opts?.correlationId,
          eventType: 'governance.agent_plan_blocked',
          payload: { agentPlanId: id, reason: 'overlap_blocked' },
        });
        throw new AppError('CONFLICT', 'Plano bloqueado por sobreposicao de dominio', 409, {
          review: plan.overlapReview,
        });
      }
      await this.deps.governanceAuditRepo.append({
        workspaceId,
        userId: opts?.actorUserId,
        correlationId: opts?.correlationId,
        eventType: 'governance.overlap_warning_allowed',
        payload: { route: 'agent_plan.execute', agentPlanId: id, decision: 'blocked' },
      });
      responseMeta.governanceWarning = {
        decision: 'block',
        summary: plan.overlapReview?.summary,
        matches: plan.overlapReview?.matches,
      };
    }

    await this.repo.update(workspaceId, id, { status: 'executing' });

    if (plan.decision === 'reuse_existing') {
      const top = (plan.overlapReview?.matches ?? [])[0];
      const updated = await this.repo.update(workspaceId, id, {
        status: 'executed',
        result: { reusedAgentId: top?.agentId ?? null, reusedAgentName: top?.agentName ?? null },
      });
      if (!updated) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
      await this.deps.governanceAuditRepo.append({
        workspaceId,
        userId: opts?.actorUserId,
        correlationId: opts?.correlationId,
        eventType: 'governance.agent_plan_execute',
        payload: {
          agentPlanId: id,
          kind: 'reuse',
          reusedAgentId: top?.agentId ?? null,
          reusedAgentName: top?.agentName ?? null,
        },
      });
      return { plan: updated, responseMeta: {} };
    }

    const draftAgent = plan.draftAgent as IAgentGovernanceDraft;
    const created = await this.deps.agentRepo.create(workspaceId, {
      name: draftAgent.name,
      description: draftAgent.description ?? '',
      role: draftAgent.role,
      origin: 'company',
      skills: draftAgent.skills ?? [],
      category: normalizeAgentCategory(draftAgent.category ?? 'geral'),
      channels: draftAgent.role === 'coordinator' ? ['api'] : [],
      status: 'active',
      version: '1.0.0',
      goal: draftAgent.goal,
      responsibilities: draftAgent.responsibilities ?? [],
      domain: draftAgent.domain,
      qualityCriteria: draftAgent.qualityCriteria ?? [],
      reuseHints: draftAgent.reuseHints ?? [],
      platformManaged: draftAgent.platformManaged ?? false,
      systemRole: draftAgent.systemRole ?? null,
    });
    const updated = await this.repo.update(workspaceId, id, {
      status: 'executed',
      result: { createdAgentId: created.id, createdAgentName: created.name },
    });
    if (!updated) throw new AppError('NOT_FOUND', 'Plano de agente nao encontrado', 404);
    await this.deps.governanceAuditRepo.append({
      workspaceId,
      userId: opts?.actorUserId,
      correlationId: opts?.correlationId,
      eventType: 'governance.agent_plan_execute',
      payload: {
        agentPlanId: id,
        kind: 'create',
        createdAgentId: created.id,
        createdAgentName: created.name,
      },
    });
    return { plan: updated, responseMeta };
  }
}
