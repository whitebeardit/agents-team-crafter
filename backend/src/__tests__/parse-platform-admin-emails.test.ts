import { describe, expect, it } from '@jest/globals';
import { parsePlatformAdminEmails } from '../config/env.js';

describe('parsePlatformAdminEmails', () => {
  it('returns empty set for undefined and blank', () => {
    expect(parsePlatformAdminEmails(undefined).size).toBe(0);
    expect(parsePlatformAdminEmails('').size).toBe(0);
    expect(parsePlatformAdminEmails('  ,  ,').size).toBe(0);
  });

  it('splits trims and lowercases', () => {
    const s = parsePlatformAdminEmails(' Admin@X.com , other@Y.org ');
    expect(s.has('admin@x.com')).toBe(true);
    expect(s.has('other@y.org')).toBe(true);
    expect(s.size).toBe(2);
  });
});
