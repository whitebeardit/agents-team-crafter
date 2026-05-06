import { describe, expect, it } from '@jest/globals';
import {
  formatCoordinatorUserMessage,
  sanitizeCoordinatorModelText,
} from './format-coordinator-user-message.js';

describe('sanitizeCoordinatorModelText', () => {
  it('removes internal channel markers from user text', () => {
    expect(sanitizeCoordinatorModelText('Confirmo <|channel|>commentary')).toBe('Confirmo');
  });

  it('sanitizes current message and conversation history', () => {
    const out = formatCoordinatorUserMessage({
      trigger: 'manual',
      workspaceId: 'ws',
      teamId: 'team',
      coordinatorId: 'coord',
      message: 'Confirmo <|channel|>commentary',
      coordinatorExternalContext: {},
      conversation: {
        id: 'conv',
        history: [
          { role: 'assistant', content: 'Use specialist_abc<|channel|>commentary' },
          { role: 'user', content: 'ok <|end|>' },
        ],
      },
    });

    expect(out).not.toContain('<|channel|>');
    expect(out).not.toContain('<|end|>');
    expect(out).toContain('Confirmo');
  });
});
