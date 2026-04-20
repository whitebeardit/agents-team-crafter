import { describe, expect, it } from '@jest/globals';
import { formatRuntimeErrorWithFallback, mapNewItemsToEvents } from './openai-agents-runtime.provider.js';

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

describe('OpenAIAgentsRuntimeProvider max-turns fallback', () => {
  it('returns product-friendly fallback when max turns is exceeded', () => {
    const out = formatRuntimeErrorWithFallback('Erro ao executar modelo', 'Max turns (10) exceeded');
    expect(out).toContain('Nao consegui concluir este fluxo dentro do limite');
    expect(out).toContain('Liste todos os clientes cadastrados');
    expect(out).toContain('Busque cliente pelo email');
  });

  it('keeps original format for non-max-turns errors', () => {
    const out = formatRuntimeErrorWithFallback('Erro ao executar modelo', 'upstream timeout');
    expect(out).toBe('Erro ao executar modelo: upstream timeout');
  });
});
