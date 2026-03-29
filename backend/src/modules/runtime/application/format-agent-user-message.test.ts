import { describe, expect, it } from '@jest/globals';
import { formatAgentUserMessage } from './format-agent-user-message.js';

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
});
