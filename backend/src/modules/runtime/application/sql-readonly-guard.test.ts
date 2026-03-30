import { describe, expect, it } from '@jest/globals';
import { assertReadOnlySelectSql } from './sql-readonly-guard.js';

describe('assertReadOnlySelectSql', () => {
  it('accepts simple select', () => {
    expect(assertReadOnlySelectSql('SELECT 1')).toContain('SELECT');
  });

  it('rejects insert', () => {
    expect(() => assertReadOnlySelectSql('INSERT INTO x VALUES (1)')).toThrow();
  });

  it('rejects multiple statements', () => {
    expect(() => assertReadOnlySelectSql('SELECT 1; SELECT 2')).toThrow();
  });
});
