import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  collectPlannerActionIds,
  actionIdToToolSlug,
  collectAgentBindActionCandidates,
  computePlannerBindActionUniverse,
  hasPerAgentBindHints,
  mergePlannerPackIdsForBind,
  PLANNER_PACK_IDS,
  PLANNER_PACK_TO_ACTION_IDS,
} from './planner-pack-presets.js';

function readFrontendPlannerPackLabelKeys() {
  const file = resolve(process.cwd(), '../v0-team-ai-crafter/lib/planner-pack-labels.ts');
  const src = readFileSync(file, 'utf8');
  const match = src.match(/export const PLANNER_PACK_LABELS_PT:[\s\S]*?=\s*\{([\s\S]*?)\n\}/);
  if (!match?.[1]) throw new Error('PLANNER_PACK_LABELS_PT not found in frontend labels file');
  return Array.from(match[1].matchAll(/^\s*([a-z0-9_]+):\s*"/gm)).map((m) => m[1] as string);
}

describe('collectPlannerActionIds', () => {
  it('merges requiredTools and pack presets without duplicates', () => {
    const ids = collectPlannerActionIds(['crm_create_party'], ['crm']);
    expect(ids).toContain('crm_create_party');
    expect(ids).toContain('crm_find_party');
    expect(ids.filter((x) => x === 'crm_create_party').length).toBe(1);
  });

  it('returns only tools when packs unknown', () => {
    const ids = collectPlannerActionIds(['business.ping'], ['unknown_pack']);
    expect(ids).toEqual(['business.ping']);
  });

  it('expands finance pack with several registered actions', () => {
    const ids = collectPlannerActionIds([], ['finance']);
    expect(ids).toContain('finance_create_receivable');
    expect(ids).toContain('finance_create_payable');
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });

  it('expands scheduling pack with appointment actions', () => {
    const ids = collectPlannerActionIds([], ['scheduling']);
    expect(ids).toContain('schedule_create_appointment');
    expect(ids).toContain('schedule_complete_appointment');
    expect(ids).toContain('schedule_get_availability');
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });
});

describe('PLANNER_PACK_IDS', () => {
  it('matches keys of PLANNER_PACK_TO_ACTION_IDS', () => {
    expect(new Set(PLANNER_PACK_IDS)).toEqual(new Set(Object.keys(PLANNER_PACK_TO_ACTION_IDS)));
  });

  it('stays aligned with frontend PT-BR labels', () => {
    expect(new Set(PLANNER_PACK_IDS)).toEqual(new Set(readFrontendPlannerPackLabelKeys()));
  });
});

describe('actionIdToToolSlug', () => {
  it('normalizes action id to slug', () => {
    expect(actionIdToToolSlug('crm_create_party')).toBe('ba-crm-create-party');
    expect(actionIdToToolSlug('crm_delete_party')).toBe('ba-crm-delete-party');
  });
});

describe('Loop 83 — bind per agent', () => {
  it('hasPerAgentBindHints detecta listas por agente', () => {
    expect(hasPerAgentBindHints([{ requiredBusinessActionIds: [], requiredPackIds: [] }])).toBe(false);
    expect(hasPerAgentBindHints([{ requiredBusinessActionIds: ['crm_create_party'], requiredPackIds: [] }])).toBe(
      true,
    );
    expect(hasPerAgentBindHints([{ requiredBusinessActionIds: [], requiredPackIds: ['crm'] }])).toBe(true);
  });

  it('modo legado: todos os agentes partilham o mesmo conjunto global', () => {
    const agents = [
      { role: 'coordinator' as const, requiredBusinessActionIds: [] as string[], requiredPackIds: [] as string[] },
      { role: 'specialist' as const, requiredBusinessActionIds: [], requiredPackIds: [] },
    ];
    const u = computePlannerBindActionUniverse(agents, ['business.ping'], ['crm'], 64);
    expect(u.usePerAgentMode).toBe(false);
    expect(u.actionIdsFull).toEqual(collectPlannerActionIds(['business.ping'], ['crm']));
    expect(u.perAgentActionIds[0]).toEqual(u.perAgentActionIds[1]);
  });

  it('modo per-agent: especialistas com packs distintos geram candidatos disjuntos', () => {
    const agents = [
      { role: 'coordinator' as const, requiredBusinessActionIds: [], requiredPackIds: [] },
      { role: 'specialist' as const, requiredBusinessActionIds: [], requiredPackIds: ['crm'] },
      { role: 'specialist' as const, requiredBusinessActionIds: [], requiredPackIds: ['scheduling'] },
    ];
    const u = computePlannerBindActionUniverse(agents, [], [], 64);
    expect(u.usePerAgentMode).toBe(true);
    expect(u.perAgentActionIds[0]?.length ?? 0).toBe(0);
    expect(u.perAgentActionIds[1]).toContain('crm_create_party');
    expect(u.perAgentActionIds[1]!.some((id) => id.startsWith('schedule_'))).toBe(false);
    expect(u.perAgentActionIds[2]?.some((id) => id.startsWith('schedule_'))).toBe(true);
    expect(u.perAgentActionIds[2]?.some((id) => id.startsWith('crm_'))).toBe(false);
    const union = new Set([...u.perAgentActionIds[1]!, ...u.perAgentActionIds[2]!]);
    expect(union.size).toBe(u.perAgentActionIds[1]!.length + u.perAgentActionIds[2]!.length);
  });

  it('collectAgentBindActionCandidates em modo per-agent ignora globais', () => {
    const a = { role: 'specialist' as const, requiredBusinessActionIds: [] as string[], requiredPackIds: ['finance'] };
    expect(collectAgentBindActionCandidates(a, ['business.ping'], ['crm'], true)).toEqual(
      collectPlannerActionIds([], ['finance']),
    );
  });

  it('mergePlannerPackIdsForBind une global e por agente', () => {
    expect(
      new Set(
        mergePlannerPackIdsForBind(
          [{ requiredPackIds: ['scheduling'] }, { requiredPackIds: ['crm'] }],
          ['finance'],
        ),
      ),
    ).toEqual(new Set(['finance', 'scheduling', 'crm']));
  });
});
