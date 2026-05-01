import { describe, expect, it } from '@jest/globals';
import { formatAgentUserContentParts, formatAgentUserMessage } from './format-agent-user-message.js';

describe('formatAgentUserMessage', () => {
  it('prefixes channel locale and taskType', () => {
    const s = formatAgentUserMessage({
      message: 'hello',
      channel: 'slack',
      locale: 'pt-BR',
      taskType: 'invoice_validation',
    });
    expect(s).toBe('[channel=slack] [locale=pt-BR] [taskType=invoice_validation] hello');
  });

  it('returns plain message when no metadata', () => {
    expect(formatAgentUserMessage({ message: 'x' })).toBe('x');
  });

  it('prefixes requestedAccessLevel when set', () => {
    expect(
      formatAgentUserMessage({
        message: 'do it',
        requestedAccessLevel: 'read',
      }),
    ).toBe('[access=read] do it');
  });

  it('prepends formatted text before existing multimodal parts', () => {
    const out = formatAgentUserContentParts({
      message: 'analise',
      channel: 'debug',
      contentParts: [{ type: 'input_image', imageUrl: 'https://example.com/i.png' }],
    });
    expect(out).toEqual([
      { type: 'input_text', text: '[channel=debug] analise' },
      { type: 'input_image', imageUrl: 'https://example.com/i.png' },
    ]);
  });
});
