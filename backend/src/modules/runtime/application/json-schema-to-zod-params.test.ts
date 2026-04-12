import { jsonSchemaToZodParams } from './json-schema-to-zod-params.js';

describe('jsonSchemaToZodParams', () => {
  it('marks root object as strict to avoid permissive additionalProperties schema', () => {
    const params = jsonSchemaToZodParams({
      type: 'object',
      properties: {
        partyId: { type: 'string' },
      },
      required: ['partyId'],
    });

    const parsed = params.safeParse({ partyId: 'p_123' });
    expect(parsed.success).toBe(true);

    const withUnknown = params.safeParse({ partyId: 'p_123', extra: 'x' });
    expect(withUnknown.success).toBe(false);
  });

  it('uses strict empty object fallback when schema is invalid', () => {
    const params = jsonSchemaToZodParams({ type: 'array' });
    expect(params.safeParse({}).success).toBe(true);
    expect(params.safeParse({ any: 'value' }).success).toBe(false);
  });
});
