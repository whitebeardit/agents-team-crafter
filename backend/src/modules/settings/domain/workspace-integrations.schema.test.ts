import { describe, expect, it } from '@jest/globals';
import {
  assertWorkspaceChatModelsCoherent,
  mergeWorkspaceIntegrationsPayload,
  maskIntegrationsForApi,
} from './workspace-integrations.schema.js';

describe('workspace integrations image model settings', () => {
  it('persists and masks OpenRouter default image model separately from runtime model', () => {
    const next = mergeWorkspaceIntegrationsPayload(
      {},
      {
        llmProvider: 'openrouter',
        openrouterRuntimeModel: 'openai/gpt-4o-mini',
        openrouterImageGenerationModel: 'black-forest-labs/flux.2-klein-4b',
      },
    );

    expect(next.openrouterRuntimeModel).toBe('openai/gpt-4o-mini');
    expect(next.openrouterImageGenerationModel).toBe('black-forest-labs/flux.2-klein-4b');
    expect(maskIntegrationsForApi(next).openrouterImageGenerationModel).toBe(
      'black-forest-labs/flux.2-klein-4b',
    );
  });

  it('requires OpenRouter image model to be in allowed list when list is constrained', () => {
    expect(() =>
      assertWorkspaceChatModelsCoherent({
        llmProvider: 'openrouter',
        allowedLlmModelIds: ['openai/gpt-4o-mini'],
        openrouterImageGenerationModel: 'black-forest-labs/flux.2-klein-4b',
      }),
    ).toThrow('modelo de imagem OpenRouter deve estar entre os modelos permitidos');
  });
});
