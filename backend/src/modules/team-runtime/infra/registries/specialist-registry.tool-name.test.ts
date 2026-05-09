import { describe, expect, it } from '@jest/globals';
import {
  normalizeSpecialistToolName,
  resolveSpecialistAgentIdFromToolName,
  specialistToolName,
  specialistToolNamesForRegistration,
} from './specialist-registry.js';

describe('resolveSpecialistAgentIdFromToolName', () => {
  it('resolves tool name back to the specialist id from roster', () => {
    const id = '507f1f77bcf86cd799439011';
    const tool = specialistToolName(id);
    expect(resolveSpecialistAgentIdFromToolName(tool, [id, 'other'])).toBe(id);
  });

  it('returns undefined when tool is not a known specialist tool', () => {
    expect(resolveSpecialistAgentIdFromToolName('some_other_tool', ['a', 'b'])).toBeUndefined();
  });

  it('normalizes channel markers appended to tool names', () => {
    const id = '69f50aee8530682919c835ba';
    const contaminated = `${specialistToolName(id)}<|channel|>commentary`;
    expect(normalizeSpecialistToolName(contaminated)).toBe(specialistToolName(id));
    expect(resolveSpecialistAgentIdFromToolName(contaminated, [id])).toBe(id);
  });

  it('normalizes spurious .json suffix on specialist tool names', () => {
    const id = '69f3d7aa7ae722d6caf4df72';
    const bogus = `${specialistToolName(id)}.json`;
    expect(normalizeSpecialistToolName(bogus)).toBe(specialistToolName(id));
    expect(resolveSpecialistAgentIdFromToolName(bogus, [id])).toBe(id);
  });
});

describe('specialistToolNamesForRegistration', () => {
  it('includes a .json alias distinct from the canonical name (SDK matches exact strings)', () => {
    const id = '69f3d7aa7ae722d6caf4df72';
    const names = specialistToolNamesForRegistration(id);
    expect(names).toContain(specialistToolName(id));
    expect(names).toContain(`${specialistToolName(id)}.json`);
    expect(names.length).toBe(2);
  });
});
