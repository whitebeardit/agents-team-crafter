import { describe, expect, it } from '@jest/globals';
import { normalizeAgentCategory } from './agent-category.js';

describe('normalizeAgentCategory', () => {
  it('trims and lowercases', () => {
    expect(normalizeAgentCategory('  CODE  ')).toBe('code');
    expect(normalizeAgentCategory('Code')).toBe('code');
  });

  it('collapses separators to single hyphen', () => {
    expect(normalizeAgentCategory('foo   bar')).toBe('foo-bar');
    expect(normalizeAgentCategory('foo___bar')).toBe('foo-bar');
  });

  it('uses geral when empty after normalization', () => {
    expect(normalizeAgentCategory('')).toBe('geral');
    expect(normalizeAgentCategory('   ---   ')).toBe('geral');
  });

  it('maps Geral default to geral', () => {
    expect(normalizeAgentCategory('Geral')).toBe('geral');
  });
});
