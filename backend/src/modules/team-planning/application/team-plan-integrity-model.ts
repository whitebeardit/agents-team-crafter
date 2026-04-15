import type { ITeamPlannerStructuredBriefing } from './team-plan-planner-prompt.js';

export interface ITeamPlanIntegrityMasterEntity {
  domain: string;
  entity: string;
  naturalKey: string;
}

export interface ITeamPlanIntegrityModel {
  status: 'defined' | 'incomplete';
  masterEntities: ITeamPlanIntegrityMasterEntity[];
  linkRules: string[];
  deduplicationRules: string[];
  missingSignals: string[];
}

function normalize(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function defaultNaturalKey(entity: string): string {
  if (entity.includes('paciente')) return 'patient.externalId || patient.document';
  if (entity.includes('cliente')) return 'customer.externalId || customer.document';
  if (entity.includes('lead')) return 'lead.externalId || lead.email';
  if (entity.includes('agenda') || entity.includes('appointment')) return 'appointment.externalId || appointment.startsAt+partyId';
  return `${entity}.externalId`;
}

export function buildTeamPlanIntegrityModel(briefing?: ITeamPlannerStructuredBriefing): ITeamPlanIntegrityModel {
  const domains = normalize(briefing?.domainsNeeded);
  const entities = normalize(briefing?.mainEntities);
  const sharedEntities = normalize(briefing?.sharedEntities);
  const integrityNeeds = normalize(briefing?.crossDomainIntegrityNeeds);

  const missingSignals: string[] = [];
  if (domains.length > 1 && sharedEntities.length === 0) missingSignals.push('sharedEntities');
  if (domains.length > 1 && integrityNeeds.length === 0) missingSignals.push('crossDomainIntegrityNeeds');

  const masterEntities: ITeamPlanIntegrityMasterEntity[] = (sharedEntities.length > 0 ? sharedEntities : entities)
    .slice(0, 5)
    .map((entity, idx) => ({
      domain: domains[idx] ?? domains[0] ?? 'operacao',
      entity,
      naturalKey: defaultNaturalKey(entity),
    }));

  const linkRules = masterEntities.map(
    (item) => `Especialistas que manipulam ${item.entity} devem referenciar a mesma chave natural (${item.naturalKey}).`,
  );
  const deduplicationRules = [
    'Bloquear criação quando já existir entidade com mesma chave natural no workspace.',
    'Atualizações devem reutilizar ID canônico em vez de criar novo cadastro paralelo.',
  ];

  return {
    status: missingSignals.length > 0 ? 'incomplete' : 'defined',
    masterEntities,
    linkRules,
    deduplicationRules,
    missingSignals,
  };
}
