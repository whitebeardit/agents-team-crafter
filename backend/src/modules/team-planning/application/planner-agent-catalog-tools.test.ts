import { describe, expect, it } from '@jest/globals';
import {
  inferCatalogPackContextLower,
  inferCatalogToolsForPlanAgent,
  resolveCatalogToolsForPlanAgent,
} from './planner-agent-catalog-tools.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

const wf82 = {
  workflowKey: '',
  requiredBusinessActionIds: [] as string[],
  requiredPackIds: [] as string[],
};

function basePlan(agents: TPlannerOutput['agents'], requiredPacks: string[] = []): TPlannerOutput {
  return {
    team: {
      name: 'Time Teste',
      objective: 'Objetivo de teste com mais de dez caracteres.',
      description: '',
      channelIds: [],
      singleAgentMode: false,
    },
    agents,
    graph: { nodes: [], edges: [] },
    executionChecklist: [],
    requiredPacks,
    requiredTools: [],
  };
}

function specialistBase(name: string, overrides: Partial<TPlannerOutput['agents'][number]> = {}): TPlannerOutput['agents'][number] {
  return {
    name,
    role: 'specialist',
    description: 'x',
    objective: 'y',
    responsibilities: [],
    skills: [],
    category: 'geral',
    channels: [],
    catalogTools: [],
    exampleUserPhrases: ['Preciso de ajuda com o dominio', 'Executa a tarefa principal'],
    ...wf82,
    ...overrides,
  };
}

describe('planner-agent-catalog-tools', () => {
  it('coordenador recebe web_search por defeito', () => {
    const plan = basePlan([
      {
        name: 'Coord',
        role: 'coordinator',
        description: '',
        objective: '',
        responsibilities: [],
        skills: [],
        category: 'geral',
        channels: [],
        catalogTools: [],
        exampleUserPhrases: [],
        ...wf82,
      },
    ]);
    const t = inferCatalogToolsForPlanAgent(plan.agents[0]!, {
      specialistIndex: 0,
      requiredPacksLower: [],
    });
    expect(t).toEqual(['web_search']);
  });

  it('coordenador com scheduling nos packs globais recebe web_search e calendar_access', () => {
    const plan = basePlan(
      [
        {
          name: 'Coord',
          role: 'coordinator',
          description: '',
          objective: '',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: [],
          catalogTools: [],
          exampleUserPhrases: [],
          ...wf82,
        },
      ],
      ['scheduling'],
    );
    const t = inferCatalogToolsForPlanAgent(plan.agents[0]!, {
      specialistIndex: 0,
      requiredPacksLower: inferCatalogPackContextLower(plan.agents[0]!, plan),
    });
    expect(t.sort()).toEqual(['calendar_access', 'web_search'].sort());
  });

  it('especialistas genéricos sem packs não diferenciam por índice (Loop 84)', () => {
    const spec = (name: string, idx: number) =>
      inferCatalogToolsForPlanAgent(specialistBase(name), { specialistIndex: idx, requiredPacksLower: [] });
    expect(spec('A', 0).sort()).toEqual(spec('B', 1).sort());
    expect(spec('A', 0)).toEqual(['web_search']);
  });

  it('packs scheduling/reminders reforçam calendar_access (Loop 87: sem internal_actions stub)', () => {
    const t = inferCatalogToolsForPlanAgent(specialistBase('S'), {
      specialistIndex: 0,
      requiredPacksLower: ['scheduling'],
    });
    expect(t).toContain('web_search');
    expect(t).toContain('calendar_access');
    expect(t).not.toContain('internal_actions');
  });

  it('inferCatalogPackContextLower usa requiredPackIds do agente quando preenchido', () => {
    const plan = basePlan([specialistBase('S', { requiredPackIds: ['crm'] })], ['scheduling']);
    expect(inferCatalogPackContextLower(plan.agents[0]!, plan)).toEqual(['crm']);
  });

  it('inferCatalogPackContextLower herda requiredPacks globais quando agente não tem packs', () => {
    const plan = basePlan([specialistBase('S')], ['finance']);
    expect(inferCatalogPackContextLower(plan.agents[0]!, plan)).toEqual(['finance']);
  });

  it('Loop 86: com hints por agente num especialista, outro não herda packs globais', () => {
    const plan = basePlan(
      [specialistBase('S1', { requiredPackIds: ['crm'] }), specialistBase('S2')],
      ['finance'],
    );
    expect(inferCatalogPackContextLower(plan.agents[1]!, plan)).toEqual([]);
  });

  it('resolveCatalogToolsForPlanAgent respeita lista explícita do planner', () => {
    const plan = basePlan([
      {
        name: 'S',
        role: 'specialist',
        description: '',
        objective: '',
        responsibilities: [],
        skills: [],
        category: 'geral',
        channels: [],
        catalogTools: ['image_generation', 'web_search'],
        exampleUserPhrases: ['Gera uma imagem para o post', 'Cria arte com o tema X'],
        ...wf82,
      },
    ]);
    const out = resolveCatalogToolsForPlanAgent(plan.agents[0]!, { plan, specialistIndex: 0 });
    expect(out).toContain('image_generation');
    expect(out).toContain('web_search');
  });
});
