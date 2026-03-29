import { describe, expect, it } from '@jest/globals';
import { parseDslPresets } from '../modules/runtime/application/dsl/parse-presets.js';
import { decideHandoff } from '../modules/runtime/application/policy-engine.js';

describe('runtime policy + DSL presets', () => {
  it('routes by taskType when allowed', () => {
    const rules = parseDslPresets([
      'guard:maxDepth:2',
      'guard:noRepeat:true',
      'route:taskType:invoice_validation->agent:agent_billing_specialist',
    ]);

    const d = decideHandoff({
      workspaceId: 'ws',
      currentAgentId: 'agent_a',
      depth: 0,
      visitedAgentIds: ['agent_a'],
      canDelegate: true,
      handoffTargets: ['agent_billing_specialist'],
      taskType: 'invoice_validation',
      rules,
    });

    expect(d.kind).toBe('handoff');
    if (d.kind === 'handoff') expect(d.nextAgentId).toBe('agent_billing_specialist');
  });

  it('blocks handoff when target not allowed', () => {
    const rules = parseDslPresets(['route:taskType:invoice_validation->agent:agent_billing_specialist']);
    expect(() =>
      decideHandoff({
        workspaceId: 'ws',
        currentAgentId: 'agent_a',
        depth: 0,
        visitedAgentIds: ['agent_a'],
        canDelegate: true,
        handoffTargets: [],
        taskType: 'invoice_validation',
        rules,
      }),
    ).toThrow(/target nao permitido/i);
  });

  it('blocks loop when noRepeat enabled', () => {
    const rules = parseDslPresets(['guard:noRepeat:true', 'route:taskType:x->agent:agent_b']);
    expect(() =>
      decideHandoff({
        workspaceId: 'ws',
        currentAgentId: 'agent_a',
        depth: 0,
        visitedAgentIds: ['agent_a', 'agent_b'],
        canDelegate: true,
        handoffTargets: ['agent_b'],
        taskType: 'x',
        rules,
      }),
    ).toThrow(/loop/i);
  });
});

