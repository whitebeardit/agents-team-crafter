import { describe, expect, it } from '@jest/globals';
import { mapNewItemsToEvents } from './openai-agents-runtime.provider.js';

describe('mapNewItemsToEvents', () => {
  it('marks toolResult as error when function_call_output returns runtime error payload', () => {
    const events = mapNewItemsToEvents({
      newItems: [
        {
          type: 'tool_call_item',
          rawItem: { type: 'function_call', callId: 'call-1', name: 'ws_crm_create_party' },
        },
        {
          rawItem: {
            type: 'function_call_output',
            callId: 'call-1',
            output: JSON.stringify({
              ok: false,
              errorCode: 'MISSING_REQUIRED_FIELDS',
              error: 'Campos obrigatorios em falta: displayName',
            }),
          },
        },
      ],
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: 'toolResult',
        tool: 'ws_crm_create_party',
        status: 'error',
        errorCode: 'MISSING_REQUIRED_FIELDS',
      }),
    ]);
  });
});

