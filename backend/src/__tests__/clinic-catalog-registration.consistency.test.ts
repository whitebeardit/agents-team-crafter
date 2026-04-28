import { describe, expect, it } from '@jest/globals';
import { createDeps } from '../config/container.js';
import type { IEnv } from '../config/env.js';

const env: IEnv = {
  NODE_ENV: 'test',
  PORT: 3001,
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_SECRET: '01234567890123456789012345678901',
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '30d',
  CORS_ORIGIN: '*',
  OPENAI_API_KEY: 'test-key',
  SLACK_SIGNING_SECRET: 'test-secret',
};

describe('clinic catalog x handlers consistency', () => {
  it('ensures every published clinic/team_delegate action has a registered handler', () => {
    const deps = createDeps(env);
    const actionIds = deps.businessToolRegistry
      .listCatalog()
      .map((item) => item.actionId)
      .filter((actionId) => actionId.startsWith('clinic_') || actionId.startsWith('team_delegate_to_'));

    expect(actionIds.length).toBeGreaterThan(0);

    for (const actionId of actionIds) {
      expect(deps.businessToolRegistry.get(actionId)).toBeDefined();
    }
  });
});
