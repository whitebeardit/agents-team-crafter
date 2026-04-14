import { afterEach, describe, expect, it } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerGithubOpsPack } from './register-github-ops-pack.js';

describe('registerGithubOpsPack — github_ops_gold_gate', () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const originalGhToken = process.env.GH_TOKEN;

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
    process.env.GH_TOKEN = originalGhToken;
  });

  it('returns blocked gate when token is missing', async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    const registry = new BusinessToolRegistry();
    registerGithubOpsPack(registry);
    const gate = registry.get('github_ops_gold_gate');

    const out = await gate!({ workspaceId: '507f1f77bcf86cd799439011', input: {} });
    expect(out).toMatchObject({
      approved: false,
      blockingCriteria: [
        expect.objectContaining({
          code: 'github_token_configured',
          passed: false,
        }),
      ],
      snapshot: expect.objectContaining({ hasToken: false, checkedConnectivity: false }),
    });
  });

  it('returns approved gate when token exists and no connectivity probe is requested', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const registry = new BusinessToolRegistry();
    registerGithubOpsPack(registry);
    const gate = registry.get('github_ops_gold_gate');

    const out = await gate!({ workspaceId: '507f1f77bcf86cd799439011', input: {} });
    expect(out).toMatchObject({
      approved: true,
      criteria: [
        expect.objectContaining({
          code: 'github_token_configured',
          passed: true,
        }),
      ],
      snapshot: expect.objectContaining({ hasToken: true, checkedConnectivity: false, connectivityOk: null }),
    });
  });
});
