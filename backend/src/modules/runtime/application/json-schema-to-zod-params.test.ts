import { describe, expect, it } from '@jest/globals';
import { jsonSchemaToZodParams } from './json-schema-to-zod-params.js';

describe('jsonSchemaToZodParams (strict OpenAI function schema compatibility)', () => {
  it('converte campos não obrigatórios para nullable obrigatório (evita properties fora de required)', () => {
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

    // modo estrito: as chaves em properties devem ser enviadas (null quando opcional)
    expect(params.safeParse({ partyId: 'pty_1' }).success).toBe(false);
  });

  it('não gera objeto permissivo via passthrough para schema inválido', () => {
    const params = jsonSchemaToZodParams({ type: 'string' });
    expect(params.safeParse({ any: 'value' }).success).toBe(true);
  });
});
