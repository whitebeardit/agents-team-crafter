import { describe, expect, it } from '@jest/globals';
import { evaluateTeamPlanAdequacy } from './team-plan-adequacy-gate.js';

describe('team-plan-adequacy-gate (Loop 130.5)', () => {
  it('retorna adequate para plano coerente com briefing', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: {
          name: 'Time Clinica',
          objective: 'Operar jornada',
          description: 'x',
          channelIds: [],
          primaryChannel: 'whatsapp',
          singleAgentMode: false,
        },
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
            exampleUserPhrases: [],
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
            exampleUserPhrases: ['Cria cliente', 'Lista clientes cadastrados'],
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
        team: {
          name: 'Time',
          objective: 'x',
          description: 'x',
          channelIds: [],
          primaryChannel: 'api',
          singleAgentMode: false,
        },
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

  it('briefing Web/App alinha com team.primaryChannel api (sinónimo)', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: {
          name: 'Time Clinica',
          objective: 'Operar jornada com dez chars.',
          description: 'x',
          channelIds: [],
          primaryChannel: 'api',
          singleAgentMode: false,
        },
        agents: [
          {
            name: 'Coord',
            role: 'coordinator',
            description: '',
            objective: '',
            responsibilities: [],
            skills: [],
            category: 'coord',
            channels: ['api'],
            catalogTools: ['web_search'],
            workflowKey: 'coordination',
            requiredBusinessActionIds: [],
            requiredPackIds: [],
            exampleUserPhrases: [],
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
            exampleUserPhrases: ['Cria cliente', 'Lista clientes cadastrados'],
          },
        ],
        requiredPacks: ['crm'],
        requiredTools: ['crm_create_party'],
      },
      briefing: {
        domainsNeeded: ['crm'],
        operationKinds: ['crud'],
        primaryChannel: 'Web/App',
      },
    });
    expect(result.status).toBe('adequate');
    expect(result.issues.filter((i) => i.includes('Canal'))).toHaveLength(0);
  });

  it('aceita plano clinico quando usa clinic_ops e actions clinic_*', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: {
          name: 'Time Clinica GOLD',
          objective: 'Operar jornada clinica por telefone.',
          description: 'x',
          channelIds: [],
          primaryChannel: 'whatsapp',
          singleAgentMode: false,
        },
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
            exampleUserPhrases: [],
          },
          {
            name: 'Agenda Clinica',
            role: 'specialist',
            description: '',
            objective: '',
            responsibilities: [],
            skills: [],
            category: 'agenda_clinica',
            channels: [],
            catalogTools: ['web_search'],
            workflowKey: 'clinic_scheduling',
            requiredBusinessActionIds: ['clinic_schedule_session_by_phone'],
            requiredPackIds: ['clinic_ops'],
            exampleUserPhrases: ['Agende a sessao da paciente', 'Liste as sessoes dela'],
          },
        ],
        requiredPacks: ['clinic_ops'],
        requiredTools: ['clinic_schedule_session_by_phone'],
      },
      briefing: {
        businessType: 'clinica psicologica',
        domainsNeeded: ['clinic_ops'],
        mainEntities: ['paciente', 'sessao'],
        operationKinds: ['agendamento', 'atendimento'],
        primaryChannel: 'whatsapp',
      },
    });
    expect(result.status).toBe('adequate');
    expect(result.issues).toHaveLength(0);
  });

  it('rejeita plano clinico que usa apenas primitivas universais', () => {
    const result = evaluateTeamPlanAdequacy({
      plan: {
        team: {
          name: 'Time Clinica Primitivo',
          objective: 'Operar agenda clinica.',
          description: 'x',
          channelIds: [],
          primaryChannel: 'whatsapp',
          singleAgentMode: false,
        },
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
            exampleUserPhrases: [],
          },
          {
            name: 'Agenda Universal',
            role: 'specialist',
            description: '',
            objective: '',
            responsibilities: [],
            skills: [],
            category: 'scheduling',
            channels: [],
            catalogTools: ['web_search'],
            workflowKey: 'scheduling',
            requiredBusinessActionIds: ['schedule_create_appointment'],
            requiredPackIds: ['scheduling'],
            exampleUserPhrases: ['Agende a sessao', 'Liste a agenda'],
          },
        ],
        requiredPacks: ['scheduling'],
        requiredTools: ['schedule_create_appointment'],
      },
      briefing: {
        businessType: 'clinica psicologica',
        domainsNeeded: ['scheduling'],
        mainEntities: ['paciente', 'sessao'],
        operationKinds: ['agendamento'],
        primaryChannel: 'whatsapp',
      },
    });
    expect(result.status).toBe('inadequate');
    expect(result.issues).toContain(
      'Plano clínico deveria priorizar clinic_ops/clinic_* em vez de apenas primitivas universais.',
    );
  });
});
