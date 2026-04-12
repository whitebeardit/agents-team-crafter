import { describe, expect, it } from '@jest/globals';
import {
  buildTeamPlannerUserMessage,
  PLANNER_SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS,
  TEAM_PLANNER_REPAIR_SYSTEM_PROMPT,
  TEAM_PLANNER_SYSTEM_PROMPT,
} from './team-plan-planner-prompt.js';

describe('team-plan-planner-prompt (Loop 77)', () => {
  it('lista IDs exclusivos entre especialistas e mantém regra no texto do sistema', () => {
    expect(PLANNER_SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS.length).toBeGreaterThan(0);
    for (const id of PLANNER_SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS) {
      expect(TEAM_PLANNER_SYSTEM_PROMPT).toContain(`"${id}"`);
    }
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toMatch(/Unicidade de catalogTools entre ESPECIALISTAS/i);
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toMatch(/Anti-padrao/i);
  });

  it('diferencia requiredPacks, requiredTools e catalogTools', () => {
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toMatch(/requiredPacks vs catalogTools vs requiredTools/i);
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toMatch(/requiredTools.*actionIds/i);
  });

  it('exemplo JSON inclui catalogTools, requiredPacks e requiredTools', () => {
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toContain('"catalogTools": ["web_search"]');
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toContain('"requiredPacks": []');
    expect(TEAM_PLANNER_SYSTEM_PROMPT).toContain('"requiredTools": []');
  });

  it('buildTeamPlannerUserMessage reforça matriz pré-JSON e IDs exclusivos', () => {
    const msg = buildTeamPlannerUserMessage('Preciso de um time para revisar PRs.');
    expect(msg).toContain('Problema principal:');
    expect(msg).toMatch(/Antes do JSON final/i);
    expect(msg).toMatch(/matriz mental/i);
  });

  it('TEAM_PLANNER_REPAIR_SYSTEM_PROMPT lista IDs exclusivos (Loop 80)', () => {
    expect(TEAM_PLANNER_REPAIR_SYSTEM_PROMPT).toMatch(/modo CORRECAO/i);
    for (const id of PLANNER_SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS) {
      expect(TEAM_PLANNER_REPAIR_SYSTEM_PROMPT).toContain(`"${id}"`);
    }
  });
});
