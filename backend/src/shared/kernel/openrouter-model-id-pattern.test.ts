import { describe, expect, it } from '@jest/globals';
import { isOpenRouterStyleModelId } from './openrouter-model-id-pattern.js';

describe('openrouter-model-id-pattern', () => {
  it('aceita IDs com :free e alias ~', () => {
    expect(isOpenRouterStyleModelId('google/gemma-3n-e4b-it:free')).toBe(true);
    expect(isOpenRouterStyleModelId('meta-llama/llama-3.3-70b-instruct:free')).toBe(true);
    expect(isOpenRouterStyleModelId('~anthropic/claude-haiku-latest')).toBe(true);
    expect(isOpenRouterStyleModelId('x-ai/grok-4.3')).toBe(true);
    expect(isOpenRouterStyleModelId('openrouter/owl-alpha')).toBe(true);
  });

  it('rejeita formatos invalidos', () => {
    expect(isOpenRouterStyleModelId('gpt-4o')).toBe(false);
    expect(isOpenRouterStyleModelId('')).toBe(false);
    expect(isOpenRouterStyleModelId('onlyone')).toBe(false);
    expect(isOpenRouterStyleModelId('a / b')).toBe(false);
  });
});
