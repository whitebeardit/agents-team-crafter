import { decryptJson, encryptJson } from './secrets-crypto.js';

const KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('secrets-crypto', () => {
  it('roundtrips json', () => {
    const obj = { platform: 'slack', signingSecret: 'sec', botToken: 'tok' };
    const enc = encryptJson(KEY, obj);
    const out = decryptJson<typeof obj>(KEY, enc);
    expect(out).toEqual(obj);
  });
});
