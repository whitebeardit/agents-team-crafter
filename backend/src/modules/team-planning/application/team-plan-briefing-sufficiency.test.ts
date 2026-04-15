import { describe, expect, it } from '@jest/globals';
import { evaluateTeamPlanBriefingSufficiency } from './team-plan-briefing-sufficiency.js';

describe('team-plan-briefing-sufficiency (Loop 130.4)', () => {
  it('marca briefing como suficiente quando sinais mínimos estão preenchidos', () => {
    const result = evaluateTeamPlanBriefingSufficiency({
      businessGoal: 'Melhorar conversão',
      businessType: 'clínica',
      coreJourney: 'lead até atendimento',
      domainsNeeded: ['crm', 'scheduling'],
      mainEntities: ['lead', 'agenda'],
      primaryChannel: 'whatsapp',
      operationKinds: ['atendimento'],
    });
    expect(result.status).toBe('sufficient');
    expect(result.missingSignals).toHaveLength(0);
  });

  it('marca briefing como insuficiente quando faltam sinais críticos', () => {
    const result = evaluateTeamPlanBriefingSufficiency({
      businessType: 'serviços',
      domainsNeeded: ['crm'],
    });
    expect(result.status).toBe('insufficient');
    expect(result.missingSignals).toContain('businessGoal');
    expect(result.missingSignals).toContain('mainEntities');
  });
});
