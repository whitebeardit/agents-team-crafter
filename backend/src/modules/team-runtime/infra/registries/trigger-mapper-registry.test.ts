import { describe, expect, it } from '@jest/globals';
import { buildManualTeamInvocation, teamRunBodySchema } from './trigger-mapper-registry.js';

describe('teamRunBodySchema multimodal', () => {
  it('accepts inputMedia images', () => {
    const body = teamRunBodySchema.parse({
      message: 'Revise esta imagem',
      inputMedia: [{ kind: 'image', url: 'https://example.com/pic.png', mimeType: 'image/png' }],
    });
    expect(body.inputMedia?.[0]?.url).toBe('https://example.com/pic.png');
  });
});

describe('buildManualTeamInvocation', () => {
  it('maps inputMedia into invocation payload', () => {
    const inv = buildManualTeamInvocation('w1', 't1', 'c1', {
      message: 'mensagem',
      inputMedia: [{ kind: 'image', url: 'https://example.com/a.jpg' }],
    });
    expect(inv.inputMedia).toEqual([{ kind: 'image', url: 'https://example.com/a.jpg' }]);
  });
});
