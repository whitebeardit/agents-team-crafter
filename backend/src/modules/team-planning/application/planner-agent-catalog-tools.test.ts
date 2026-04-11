import { describe, expect, it } from '@jest/globals';
import { inferCatalogToolsForPlanAgent, resolveCatalogToolsForPlanAgent } from './planner-agent-catalog-tools.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

function basePlan(agents: TPlannerOutput['agents'], requiredPacks: string[] = []): TPlannerOutput {
  return {
    team: {
      name: 'Time Teste',
      objective: 'Objetivo de teste com mais de dez caracteres.',
      description: '',
      channelIds: [],
    },
    agents,
    graph: { nodes: [], edges: [] },
    executionChecklist: [],
    requiredPacks,
    requiredTools: [],
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
      },
    ]);
    const t = inferCatalogToolsForPlanAgent(plan.agents[0]!, {
      specialistIndex: 0,
      requiredPacksLower: [],
    });
    expect(t).toEqual(['web_search']);
  });

  it('especialistas genéricos diferenciam por índice', () => {
    const spec = (name: string, idx: number) =>
      inferCatalogToolsForPlanAgent(
        {
          name,
          role: 'specialist',
          description: 'x',
          objective: 'y',
          responsibilities: [],
          skills: [],
          category: 'geral',
          channels: [],
          catalogTools: [],
        },
        { specialistIndex: idx, requiredPacksLower: [] },
      );
    expect(spec('A', 0).sort()).not.toEqual(spec('B', 1).sort());
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
      },
    ]);
    const out = resolveCatalogToolsForPlanAgent(plan.agents[0]!, { plan, specialistIndex: 0 });
    expect(out).toContain('image_generation');
    expect(out).toContain('web_search');
  });
});
