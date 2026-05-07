import { describe, expect, it } from '@jest/globals';
import { slugifyPartyName } from './party-slug.js';

describe('slugifyPartyName', () => {
  it('remove acentos e usa kebab-case', () => {
    expect(slugifyPartyName('José da Silva & Cia')).toBe('jose-da-silva-cia');
  });

  it('e idempotente para slug ja normalizado', () => {
    const s = 'cliente-alpha';
    expect(slugifyPartyName(s)).toBe(s);
  });

  it('trunca comprimento maximo', () => {
    const long = 'a'.repeat(100);
    expect(slugifyPartyName(long).length).toBeLessThanOrEqual(60);
  });
});
