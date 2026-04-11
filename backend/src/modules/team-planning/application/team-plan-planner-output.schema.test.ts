import { describe, expect, it } from '@jest/globals';
import { plannerOutputSchema } from './team-plan-planner-output.schema.js';

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
        },
      ],
      graph: { nodes: [], edges: [] },
      executionChecklist: [],
      requiredPacks: [],
      requiredTools: [],
    };
    expect(plannerOutputSchema.safeParse(raw).success).toBe(true);
  });
});
