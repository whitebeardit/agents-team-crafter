import { resolveChannelHintToProductType } from '../../channels/domain/product-channel-type.js';
import type { ITeamPlannerStructuredBriefing } from './team-plan-planner-prompt.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

export interface ITeamPlanAdequacyEvaluation {
  status: 'adequate' | 'inadequate';
  issues: string[];
  suggestions: string[];
}

function normalize(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function evaluateTeamPlanAdequacy(params: {
  plan: Pick<TPlannerOutput, 'team' | 'agents' | 'requiredPacks' | 'requiredTools'>;
  briefing?: ITeamPlannerStructuredBriefing;
}): ITeamPlanAdequacyEvaluation {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const coordinatorCount = params.plan.agents.filter((agent) => agent.role === 'coordinator').length;
  const specialists = params.plan.agents.filter((agent) => agent.role === 'specialist');
  if (coordinatorCount !== 1) {
    issues.push('Plano precisa de exatamente um coordenador ativo.');
    suggestions.push('Ajuste o plano para manter um único coordenador responsável pela orquestração.');
  }
  if (specialists.length === 0) {
    issues.push('Plano sem especialista operacional.');
    suggestions.push('Inclua pelo menos um especialista alinhado à jornada principal.');
  }

  const domainsNeeded = normalize(params.briefing?.domainsNeeded);
  const sharedEntities = normalize(params.briefing?.sharedEntities);
  const integrityNeeds = normalize(params.briefing?.crossDomainIntegrityNeeds);
  if (domainsNeeded.length > 0 && specialists.length < Math.min(domainsNeeded.length, 3)) {
    issues.push('Quantidade de especialistas parece insuficiente para os domínios informados.');
    suggestions.push('Adicione especialistas por domínio essencial ou simplifique os domínios do briefing.');
  }
  if (domainsNeeded.length > 1 && sharedEntities.length === 0) {
    issues.push('Briefing multi-domínio sem entidades partilhadas explícitas para integridade.');
    suggestions.push('Defina sharedEntities para manter cliente/paciente/lead consistente entre especialistas.');
  }
  if (domainsNeeded.length > 1 && integrityNeeds.length === 0) {
    issues.push('Briefing multi-domínio sem regra de integridade entre domínios.');
    suggestions.push('Defina crossDomainIntegrityNeeds com critérios de sincronização e deduplicação.');
  }

  const planChannel = params.plan.team.primaryChannel?.trim().toLowerCase();
  const briefingResolved = resolveChannelHintToProductType(params.briefing?.primaryChannel);
  const briefingNorm =
    briefingResolved ?? params.briefing?.primaryChannel?.trim().toLowerCase();
  if (briefingNorm && planChannel && briefingNorm !== planChannel) {
    issues.push('Canal principal do plano diverge do canal principal do briefing.');
    suggestions.push('Alinhe team.primaryChannel ao canal principal informado na descoberta.');
  }

  const needsOperationalTools = normalize(params.briefing?.operationKinds).some((kind) =>
    ['crud', 'atendimento', 'automacao', 'acompanhamento'].some((token) => kind.includes(token)),
  );
  const hasOperationalCapability = (params.plan.requiredTools?.length ?? 0) > 0 || (params.plan.requiredPacks?.length ?? 0) > 0;
  if (needsOperationalTools && !hasOperationalCapability) {
    issues.push('Plano sem packs/tools de negócio para a operação declarada no briefing.');
    suggestions.push('Inclua requiredPacks/requiredTools coerentes com o tipo de operação esperado.');
  }

  return {
    status: issues.length > 0 ? 'inadequate' : 'adequate',
    issues,
    suggestions,
  };
}
