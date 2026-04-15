import { describe, expect, it } from '@jest/globals';
import { evaluateTeamPlanAdequacy } from './team-plan-adequacy-gate.js';

describe('team-plan-adequacy-gate (Loop 130.5)', () => {
  it('retorna adequate para plano coerente com briefing', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: { name: 'Time Clinica', objective: 'Operar jornada', description: 'x', channelIds: [], primaryChannel: 'whatsapp' },
        agents: [
          {
            name: 'Coord',
            role: 'coordinator',
            description: '',
            objective: '',
            responsibilities: [],
            skills: [],
            category: 'coord',
            channels: ['whatsapp'],
            catalogTools: ['web_search'],
            workflowKey: 'coordination',
            requiredBusinessActionIds: [],
            requiredPackIds: [],
          },
          {
            name: 'Esp CRM',
            role: 'specialist',
            description: '',
            objective: '',
            responsibilities: [],
            skills: [],
            category: 'crm',
            channels: [],
            catalogTools: ['internal_actions'],
            workflowKey: 'crm_ops',
            requiredBusinessActionIds: [],
            requiredPackIds: ['crm'],
          },
        ],
        requiredPacks: ['crm'],
        requiredTools: ['crm_create_party'],
      },
      briefing: {
        domainsNeeded: ['crm'],
        operationKinds: ['crud'],
        primaryChannel: 'whatsapp',
      },
    });
    expect(result.status).toBe('adequate');
    expect(result.issues).toHaveLength(0);
  });

  it('retorna inadequate quando faltam coordenação/capabilidades mínimas', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: { name: 'Time', objective: 'x', description: 'x', channelIds: [], primaryChannel: 'api' },
        agents: [],
        requiredPacks: [],
        requiredTools: [],
      },
      briefing: {
        domainsNeeded: ['crm', 'scheduling'],
        operationKinds: ['atendimento'],
        primaryChannel: 'whatsapp',
      },
    });
    expect(result.status).toBe('inadequate');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
