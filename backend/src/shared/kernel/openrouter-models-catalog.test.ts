import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { __resetOpenRouterCatalogCacheForTests, listOpenRouterCatalogModels } from './openrouter-models-catalog.js';

describe('openrouter-models-catalog', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetOpenRouterCatalogCacheForTests();
  });

  beforeEach(() => {
    __resetOpenRouterCatalogCacheForTests();
  });

  it('normaliza e filtra modelos runtime (tools)', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'anthropic/claude-sonnet',
            name: 'Claude',
            pricing: { prompt: '0.000003', completion: '0.000015' },
            supported_parameters: ['tools', 'structured_outputs'],
            architecture: { output_modalities: ['text'] },
          },
          {
            id: 'openai/gpt-4o-mini',
            name: '4o mini',
            pricing: { prompt: '0', completion: '0' },
            supported_parameters: ['max_tokens'],
            architecture: { output_modalities: ['text'] },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const { models } = await listOpenRouterCatalogModels('runtime');
    expect(models.map((m) => m.id)).toEqual(['anthropic/claude-sonnet']);
    const claude = models[0]!;
    expect(claude.pricing.promptUsdPer1M).toBeCloseTo(3, 5);
    expect(claude.pricing.completionUsdPer1M).toBeCloseTo(15, 5);
    expect(claude.pricing.isFree).toBe(false);
  });

  it('preserva ordem da API em listingIndex (nao ordena alfabeticamente)', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'z/z',
            name: 'Z',
            pricing: { prompt: '0', completion: '0' },
            supported_parameters: ['tools'],
            architecture: { output_modalities: ['text'] },
          },
          {
            id: 'a/a',
            name: 'A',
            pricing: { prompt: '0', completion: '0' },
            supported_parameters: ['tools'],
            architecture: { output_modalities: ['text'] },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const { models } = await listOpenRouterCatalogModels('runtime');
    expect(models.map((m) => m.id)).toEqual(['z/z', 'a/a']);
    expect(models.map((m) => m.listingIndex)).toEqual([0, 1]);
  });

  it('marca isFree quando prompt e completion sao zero', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'meta/llama-free',
            name: 'Llama',
            pricing: { prompt: '0', completion: '0' },
            supported_parameters: ['tools'],
            architecture: { output_modalities: ['text'] },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const { models } = await listOpenRouterCatalogModels('runtime');
    expect(models[0]!.pricing.isFree).toBe(true);
    expect(models[0]!.pricing.promptUsdPer1M).toBe(0);
    expect(models[0]!.pricing.completionUsdPer1M).toBe(0);
  });

  it('filtra planner por structured_outputs', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'google/gemini-2.5-flash',
            pricing: { prompt: '0', completion: '0.00001' },
            supported_parameters: ['structured_outputs'],
            architecture: { output_modalities: ['text'] },
          },
          {
            id: 'x/y',
            pricing: { prompt: '0.000001', completion: '0.000002' },
            supported_parameters: ['tools'],
            architecture: { output_modalities: ['text'] },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const { models } = await listOpenRouterCatalogModels('planner');
    expect(models.map((m) => m.id)).toEqual(['google/gemini-2.5-flash']);
  });
});
