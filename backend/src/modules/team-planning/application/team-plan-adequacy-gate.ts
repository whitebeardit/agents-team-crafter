import { resolveChannelHintToProductType } from '../../channels/domain/product-channel-type.js';
import type { ITeamPlannerStructuredBriefing } from './team-plan-planner-prompt.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

export interface ITeamPlanAdequacyEvaluation {
  status: 'adequate' | 'inadequate';
  issues: string[];
  suggestions: string[];
}

function normalize(values: ReadonlyArray<string | undefined> | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value?.trim().toLowerCase() ?? '').filter(Boolean))];
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function includesAny(text: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

const CLINICAL_BRIEFING_TOKENS = [
  'clinic',
  'clinica',
  'clínica',
  'saude',
  'saúde',
  'psicolog',
  'paciente',
  'sessao',
  'sessão',
  'prontuario',
  'prontuário',
  'terapia',
  'atendimento clinico',
  'atendimento clínico',
] as const;

const CLINICAL_DOMAIN_IDS = ['clinic_ops', 'clinical', 'care', 'packages_encounters', 'scheduling'] as const;

const CLINICAL_OPERATION_TOKENS = [
  'atendimento',
  'agendamento',
  'agenda',
  'sessao',
  'sessão',
  'pacote',
  'prontuario',
  'prontuário',
  'cobranca',
  'cobrança',
  'financeiro',
  'acompanhamento',
  'crud',
] as const;

export function isClinicalOperationalBriefing(briefing?: ITeamPlannerStructuredBriefing): boolean {
  if (!briefing) return false;
  const domainValues = normalize([
    briefing.primaryDomain,
    ...(briefing.secondaryDomains ?? []),
    ...(briefing.domainsNeeded ?? []),
    ...(briefing.mustHaveCapabilities ?? []),
  ]);
  const entityValues = normalize([...(briefing.mainEntities ?? []), ...(briefing.sharedEntities ?? [])]);
  const operationValues = normalize(briefing.operationKinds);
  const textBlob = [
    briefing.problemSummary,
    briefing.businessType,
    briefing.operationalUnit,
    briefing.businessGoal,
    briefing.coreJourney,
    briefing.primaryDomain,
    ...(briefing.secondaryDomains ?? []),
    ...(briefing.domainsNeeded ?? []),
    ...(briefing.mainEntities ?? []),
    ...(briefing.sharedEntities ?? []),
    ...(briefing.mustHaveCapabilities ?? []),
  ]
    .map(normalizeText)
    .join(' ');

  const hasClinicalSignal =
    includesAny(textBlob, CLINICAL_BRIEFING_TOKENS) ||
    domainValues.some((domain) => (CLINICAL_DOMAIN_IDS as readonly string[]).includes(domain)) ||
    entityValues.some((entity) => includesAny(entity, CLINICAL_BRIEFING_TOKENS));
  if (!hasClinicalSignal) return false;

  const hasOperationalSignal =
    operationValues.length === 0 ||
    operationValues.some((operation) => includesAny(operation, CLINICAL_OPERATION_TOKENS)) ||
    includesAny(textBlob, CLINICAL_OPERATION_TOKENS);
  return hasOperationalSignal;
}

export function planHasClinicWorkflow(
  plan: Pick<TPlannerOutput, 'agents' | 'requiredPacks' | 'requiredTools'>,
): boolean {
  const globalPacks = normalize(plan.requiredPacks);
  if (globalPacks.includes('clinic_ops')) return true;
  if ((plan.requiredTools ?? []).some((actionId) => actionId.trim().startsWith('clinic_'))) return true;
  return plan.agents.some((agent) => {
    const agentPacks = normalize(agent.requiredPackIds);
    return (
      agentPacks.includes('clinic_ops') ||
      (agent.requiredBusinessActionIds ?? []).some((actionId) => actionId.trim().startsWith('clinic_'))
    );
  });
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
  if (isClinicalOperationalBriefing(params.briefing) && !planHasClinicWorkflow(params.plan)) {
    issues.push('Plano clínico deveria priorizar clinic_ops/clinic_* em vez de apenas primitivas universais.');
    suggestions.push('Inclua requiredPacks ["clinic_ops"] ou actionIds clinic_* nos especialistas clínicos.');
  }

  return {
    status: issues.length > 0 ? 'inadequate' : 'adequate',
    issues,
    suggestions,
  };
}
