import { describe, expect, it } from '@jest/globals';
import { assertPersistablePartyPhone, normalizePartyPhone } from './normalize-party-phone.js';

describe('normalizePartyPhone', () => {
  it('strips non-digits (BR example)', () => {
    expect(normalizePartyPhone('+55 (79) 9 88228535')).toBe('5579988228535');
  });

  it('returns empty for only symbols', () => {
    expect(normalizePartyPhone('+-() ')).toBe('');
  });

  it('passes through digits-only', () => {
    expect(normalizePartyPhone('5511999990000')).toBe('5511999990000');
  });
});

describe('assertPersistablePartyPhone', () => {
  it('rejects empty', () => {
    expect(() => assertPersistablePartyPhone('')).toThrow('PHONE_EMPTY');
  });

  it('rejects too short', () => {
    expect(() => assertPersistablePartyPhone('1234567')).toThrow('PHONE_TOO_SHORT');
  });

  it('accepts 8 digits', () => {
    expect(() => assertPersistablePartyPhone('12345678')).not.toThrow();
  });
});
