import { describe, expect, it } from '@jest/globals';
import { buildTeamPlanIntegrityModel } from './team-plan-integrity-model.js';

describe('team-plan-integrity-model (Loop 130.6A)', () => {
  it('gera modelo definido quando briefing multi-domínio traz entidades compartilhadas e necessidades de integridade', () => {
    const model = buildTeamPlanIntegrityModel({
      domainsNeeded: ['crm', 'scheduling', 'finance'],
      mainEntities: ['cliente', 'agenda'],
      sharedEntities: ['cliente'],
      crossDomainIntegrityNeeds: ['cliente único entre CRM e financeiro'],
    });
    expect(model.status).toBe('defined');
    expect(model.masterEntities.length).toBeGreaterThan(0);
    expect(model.missingSignals).toHaveLength(0);
  });

  it('marca incompleto quando briefing multi-domínio não define sharedEntities/integridade', () => {
    const model = buildTeamPlanIntegrityModel({
      domainsNeeded: ['crm', 'clinical'],
      mainEntities: ['paciente'],
    });
    expect(model.status).toBe('incomplete');
    expect(model.missingSignals).toContain('sharedEntities');
  });
});
