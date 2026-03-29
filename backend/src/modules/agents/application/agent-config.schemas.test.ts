import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';
import { handoffSchema } from './agent-config.schemas.js';

describe('handoffSchema', () => {
  const validJsonRule = {
    id: 'rule-1',
    version: 0,
    when: { all: [{ path: 'taskType', op: 'eq', value: 'x' }] },
    then: [{ kind: 'route', targetAgentId: '507f1f77bcf86cd799439011' }],
  };

  it('aceita rules mistos: presets string e regra JSON', () => {
    const parsed = handoffSchema.parse({
      targets: ['a1', 'a2'],
      rules: ['route:taskType:invoice->agent:b1', validJsonRule],
    });
    expect(parsed.rules).toHaveLength(2);
    expect(parsed.rules[0]).toBe('route:taskType:invoice->agent:b1');
    expect(parsed.rules[1]).toEqual(validJsonRule);
  });

  it('rejeita objeto JSON que nao satisfaz dslJsonRuleSchema', () => {
    expect(() =>
      handoffSchema.parse({
        targets: ['a1'],
        rules: [{ id: '', version: -1, when: {}, then: [] }],
      }),
    ).toThrow(ZodError);
  });

  it('rejeita regra JSON sem campos obrigatorios', () => {
    expect(() =>
      handoffSchema.parse({
        targets: ['a1'],
        rules: [{ when: { all: [] } }],
      }),
    ).toThrow(ZodError);
  });
});
