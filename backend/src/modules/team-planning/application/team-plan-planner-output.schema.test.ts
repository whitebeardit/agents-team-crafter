import { describe, expect, it } from '@jest/globals';
import { padPlannerAgentsForSchemaValidation, plannerOutputSchema } from './team-plan-planner-output.schema.js';

describe('plannerOutputSchema', () => {
  it('aceita primaryChannel telegram e canais do coordenador alinhados', () => {
    const raw = {
      team: {
        name: 'Time Clinica Demo',
        objective: 'Gerir atendimentos e pacotes pelo Telegram.',
        description: 'Demo',
        primaryChannel: 'telegram',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord Telegram',
          role: 'coordinator',
          description: 'Orquestra',
          objective: 'Rotear mensagens',
          responsibilities: ['Delegar'],
          skills: ['telegram'],
          category: 'planejamento',
          channels: ['telegram'],
        },
        {
          name: 'Especialista Clinico',
          role: 'specialist',
          description: 'Prontuario',
          objective: 'Notas clinicas',
          responsibilities: ['Evolucao'],
          skills: ['saude'],
          category: 'saude',
          channels: [],
          exampleUserPhrases: ['Regista evolucao do paciente', 'Mostra o prontuario de hoje'],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: ['Conectar bot'],
      requiredPacks: [],
      requiredTools: [],
    };
    const parsed = plannerOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.team.primaryChannel).toBe('telegram');
    }
  });

  it('continua a aceitar apenas api', () => {
    const raw = {
      team: {
        name: 'Time API',
        objective: 'Objetivo minimo de dez chars.',
        description: '',
        primaryChannel: 'api',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: ['api'],
          exampleUserPhrases: [],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    expect(plannerOutputSchema.safeParse(raw).success).toBe(true);
  });

  it('normaliza catalogTools e remove ids depreciados', () => {
    const raw = {
      team: {
        name: 'Time Tools',
        objective: 'Objetivo minimo de dez caracteres.',
        description: '',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: ['api'],
          catalogTools: ['web_search', 'crm_access', 'web_search'],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    const parsed = plannerOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.agents[0]!.catalogTools).toEqual(['web_search']);
    }
  });

  it('Loop 82: dedupe requiredBusinessActionIds e lower-case requiredPackIds; workflowKey por especialista', () => {
    const raw = {
      team: {
        name: 'Time Workflow',
        objective: 'Objetivo minimo de dez caracteres.',
        description: '',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: ['api'],
          requiredBusinessActionIds: ['  a  ', 'a'],
          requiredPackIds: ['CRM', 'crm'],
        },
        {
          name: 'Esp A',
          role: 'specialist',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'alpha',
          channels: [],
          workflowKey: 'alpha_flow',
          requiredBusinessActionIds: [],
          requiredPackIds: [],
          exampleUserPhrases: ['Fluxo alpha um', 'Fluxo alpha dois'],
        },
        {
          name: 'Esp B',
          role: 'specialist',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'beta',
          channels: [],
          workflowKey: '',
          catalogTools: ['web_search'],
          exampleUserPhrases: ['Pedido beta um', 'Pedido beta dois'],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    const parsed = plannerOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.agents[0]!.requiredBusinessActionIds).toEqual(['a']);
    expect(parsed.data.agents[0]!.requiredPackIds).toEqual(['crm']);
    expect(parsed.data.agents[0]!.workflowKey).toBe('coordination');
    expect(parsed.data.agents[1]!.workflowKey).toBe('alpha_flow');
    expect(parsed.data.agents[2]!.workflowKey).toBe('beta');
  });

  it('rejeita especialista sem exampleUserPhrases suficientes', () => {
    const raw = {
      team: {
        name: 'Time Exemplos',
        objective: 'Objetivo minimo de dez caracteres.',
        description: '',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: ['api'],
        },
        {
          name: 'Esp',
          role: 'specialist',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'x',
          channels: [],
          exampleUserPhrases: ['So uma frase'],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    expect(plannerOutputSchema.safeParse(raw).success).toBe(false);
  });

  it('padPlannerAgentsForSchemaValidation completa especialista legado sem exampleUserPhrases', () => {
    const raw = {
      team: {
        name: 'Time Legado',
        objective: 'Objetivo minimo de dez caracteres.',
        description: '',
        channelIds: [],
      },
      agents: [
        {
          name: 'Coord',
          role: 'coordinator',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: ['api'],
        },
        {
          name: 'Esp',
          role: 'specialist',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'crm',
          channels: [],
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    const padded = {
      ...raw,
      agents: padPlannerAgentsForSchemaValidation(raw.agents),
    };
    expect(plannerOutputSchema.safeParse(padded).success).toBe(true);
  });
});
