import { describe, expect, it } from '@jest/globals';
import { ensurePlannerAgentWorkflowKeys, slugifyPlannerCategory } from './planner-workflow-ownership.js';

describe('planner-workflow-ownership (Loop 82)', () => {
  it('slugifyPlannerCategory remove acentos e caracteres estranhos', () => {
    expect(slugifyPlannerCategory('  Financeiro & Dados  ')).toBe('financeiro_dados');
    expect(slugifyPlannerCategory('   ')).toBe('domain');
  });

  it('coordenador recebe coordination quando workflowKey vazio', () => {
    const out = ensurePlannerAgentWorkflowKeys([
      { role: 'coordinator', category: 'x', workflowKey: '' },
    ]);
    expect(out[0]!.workflowKey).toBe('coordination');
  });

  it('especialistas com mesma category vazia de workflowKey recebem chaves unicas', () => {
    const out = ensurePlannerAgentWorkflowKeys([
      { role: 'coordinator', category: 'c', workflowKey: '' },
      { role: 'specialist', category: 'dup', workflowKey: '' },
      { role: 'specialist', category: 'dup', workflowKey: '' },
    ]);
    expect(out[1]!.workflowKey).toBe('dup');
    expect(out[2]!.workflowKey).toBe('dup__1');
  });

  it('especialistas com workflowKey explicito duplicado sao desambiguados', () => {
    const out = ensurePlannerAgentWorkflowKeys([
      { role: 'specialist', category: 'a', workflowKey: 'crm' },
      { role: 'specialist', category: 'b', workflowKey: 'crm' },
    ]);
    expect(out[0]!.workflowKey).toBe('crm');
    expect(out[1]!.workflowKey).toBe('crm__1');
  });
});
