import { buildAgentExportPayload, AGENT_EXPORT_VERSION } from './build-agent-export.js';

describe('buildAgentExportPayload', () => {
  it('inclui metadados, agent, mcpBindings e sections derivados', () => {
    const agent: Record<string, unknown> = {
      id: 'a1',
      name: 'Test',
      goal: 'g1',
      responsibilities: ['r1'],
      systemInstruction: 'si',
      systemRole: 'team-crafter',
      qualityCriteria: ['q1'],
      capabilities: { tools: ['web_search'] },
    };
    const mcp = [{ id: 'b1' }];

    const p = buildAgentExportPayload(agent, mcp);
    expect(p.exportVersion).toBe(AGENT_EXPORT_VERSION);
    expect(p.exportKind).toBe('agent');
    expect(p.agent).toBe(agent);
    expect(p.mcpBindings).toBe(mcp);
    expect(p.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.sections.mission).toEqual({ goal: 'g1', responsibilities: ['r1'] });
    expect(p.sections.system).toEqual({
      systemInstruction: 'si',
      systemRole: 'team-crafter',
      openaiRuntimeModel: undefined,
    });
    expect(p.sections.quality).toEqual({ qualityCriteria: ['q1'], reuseHints: undefined });
  });
});
