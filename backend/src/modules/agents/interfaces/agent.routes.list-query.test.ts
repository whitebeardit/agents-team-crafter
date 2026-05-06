import { describe, expect, it } from '@jest/globals';
import { listQuerySchema } from './agent.routes.js';

describe('listQuerySchema', () => {
  it('accepts teamId in agents list query', () => {
    const parsed = listQuerySchema.parse({
      page: 1,
      perPage: 25,
      teamId: '507f1f77bcf86cd799439011',
    });
    expect(parsed.teamId).toBe('507f1f77bcf86cd799439011');
  });

  it('keeps compatibility without teamId', () => {
    const parsed = listQuerySchema.parse({
      page: 1,
      perPage: 25,
      origin: 'company',
      role: 'specialist',
    });
    expect(parsed.teamId).toBeUndefined();
    expect(parsed.origin).toBe('company');
    expect(parsed.role).toBe('specialist');
  });
});
