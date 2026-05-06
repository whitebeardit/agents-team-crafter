import { describe, expect, it } from '@jest/globals';
import {
  normalizeSpecialistToolName,
  resolveSpecialistAgentIdFromToolName,
  specialistToolName,
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
});
