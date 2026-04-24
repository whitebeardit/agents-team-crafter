import { describe, expect, it } from '@jest/globals';
import { parseTeamPlanImportEnvelope, stripPlannerAgentsForImport } from './team-plan-snapshot.schema.js';

describe('team-plan-snapshot.schema', () => {
  it('stripPlannerAgentsForImport remove campos de reuso', () => {
    const agents = stripPlannerAgentsForImport([
      {
        name: 'A',
        planningMode: 'existing',
        existingAgentId: 'deadbeef',
        overlapScore: 1,
        overlapReason: 'x',
      },
    ]);
    const row = agents[0] as Record<string, unknown>;
    expect(row.planningMode).toBeUndefined();
    expect(row.existingAgentId).toBeUndefined();
    expect(row.overlapScore).toBeUndefined();
    expect(row.overlapReason).toBeUndefined();
    expect(row.name).toBe('A');
  });

  it('parseTeamPlanImportEnvelope aceita envelope v1', () => {
    const parsed = parseTeamPlanImportEnvelope({
      schemaVersion: 1,
      kind: 'team-plan-draft',
      exportedAt: '2026-01-01T00:00:00.000Z',
      plan: {
        problem: '1234567890',
        context: 'ctx',
        team: { name: 'T' },
        agents: [],
        graph: { nodes: [], edges: [] },
        executionChecklist: [],
        requiredPacks: [],
        requiredTools: [],
      },
    });
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.plan.problem).toBe('1234567890');
  });
});
