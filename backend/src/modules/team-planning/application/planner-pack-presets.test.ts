import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  collectPlannerActionIds,
  actionIdToToolSlug,
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
  });
});
