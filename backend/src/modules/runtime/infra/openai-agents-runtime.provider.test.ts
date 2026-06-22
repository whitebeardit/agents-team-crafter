import { describe, expect, it } from '@jest/globals';
import {
  buildRunnerInputFromAgentInput,
  buildRunnerInputFromCoordinatorParams,
  extractProviderErrorDetail,
  formatRuntimeErrorWithFallback,
  mapNewItemsToEvents,
} from './openai-agents-runtime.provider.js';

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

  it('appends OpenRouter invalid_function_parameters detail when SDK wraps provider error', () => {
    const cause = {
      error: {
        message: 'Provider returned error',
        code: 400,
        metadata: {
          raw: JSON.stringify({
            error: {
              message:
                "Invalid schema for function 'second_brain_recall': Missing 'agentId' in required.",
              code: 'invalid_function_parameters',
            },
          }),
        },
      },
    };
    expect(extractProviderErrorDetail(cause)).toContain('Invalid schema for function');
    const out = formatRuntimeErrorWithFallback('Erro ao executar coordenador', '400 Provider returned error', cause);
    expect(out).toContain('Erro ao executar coordenador: 400 Provider returned error');
    expect(out).toContain('Detalhe: Invalid schema for function');
  });
});

describe('multimodal runner input builders', () => {
  it('builds multimodal input from agent input', () => {
    const out = buildRunnerInputFromAgentInput({
      message: 'Revise isto',
      contentParts: [{ type: 'input_image', imageUrl: 'https://example.com/image.png' }],
    });
    expect(out).toEqual([
      { type: 'input_text', text: 'Revise isto' },
      { type: 'input_image', image_url: 'https://example.com/image.png' },
    ]);
  });

  it('builds multimodal input from coordinator params', () => {
    const out = buildRunnerInputFromCoordinatorParams({
      coordinatorAgentId: 'a1',
      workspaceId: 'w1',
      userMessage: 'Pedido',
      openaiRuntimeModel: 'gpt-4o-mini',
      sdkTools: [],
      userContentParts: [{ type: 'input_image', imageUrl: 'https://example.com/review.png' }],
    });
    expect(out).toEqual([
      { type: 'input_text', text: 'Pedido' },
      { type: 'input_image', image_url: 'https://example.com/review.png' },
    ]);
  });
});
