import { describe, expect, it } from '@jest/globals';
import { jsonSchemaToZodParams } from './json-schema-to-zod-params.js';

describe('jsonSchemaToZodParams (strict OpenAI function schema compatibility)', () => {
  it('mantém opcionais realmente opcionais e preserva chaves extras para normalização posterior', () => {
    const params = jsonSchemaToZodParams({
      type: 'object',
      properties: {
        partyId: { type: 'string' },
        displayName: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['partyId'],
    });

    expect(
      params.safeParse({
        partyId: 'pty_1',
        displayName: null,
        notes: null,
      }).success,
    ).toBe(true);

    expect(
      params.safeParse({
        partyId: 'pty_1',
        displayName: 'Rita Davila',
        notes: 'VIP',
      }).success,
    ).toBe(true);

    const parsed = params.safeParse({ partyId: 'pty_1', telefone: '+351900000000' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.telefone).toBe('+351900000000');
  });

  it('preserva payload arbitrário quando o schema é inválido', () => {
    const params = jsonSchemaToZodParams({ type: 'string' });
    const parsed = params.safeParse({ any: 'value' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.any).toBe('value');
  });
});
