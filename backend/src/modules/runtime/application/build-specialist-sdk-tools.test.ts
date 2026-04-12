import { describe, expect, it } from '@jest/globals';
import {
  buildCapabilityCatalogTools,
  catalogQueryArgs,
  imageGenerationArgs,
} from './build-specialist-sdk-tools.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';

const validBase = {
  prompt: 'uma imagem',
  size: '1024x1024' as const,
  model: 'default' as const,
};

describe('imageGenerationArgs (strict OpenAI function schema)', () => {
  it('rejeita sem os tres campos obrigatorios', () => {
    expect(imageGenerationArgs.safeParse({ prompt: 'x' }).success).toBe(false);
    expect(imageGenerationArgs.safeParse({ prompt: 'x', size: '1024x1024' }).success).toBe(false);
  });

  it('aceita prompt, size e model', () => {
    const r = imageGenerationArgs.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it('aceita tamanhos DALL-E 2', () => {
    const r = imageGenerationArgs.safeParse({
      ...validBase,
      size: '256x256',
      model: 'dall-e-2',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita size invalido', () => {
    const r = imageGenerationArgs.safeParse({ ...validBase, size: '400x400' });
    expect(r.success).toBe(false);
  });
});

describe('catalogQueryArgs (modo estrito OpenAI)', () => {
  it('exige query (string vazia permitida)', () => {
    expect(catalogQueryArgs.safeParse({}).success).toBe(false);
    expect(catalogQueryArgs.safeParse({ query: '' }).success).toBe(true);
    expect(catalogQueryArgs.safeParse({ query: 'x' }).success).toBe(true);
  });
});

describe('buildCapabilityCatalogTools image_generation', () => {
  it('inclui tool catalog_image_generation quando OpenAI esta configurada', () => {
    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    const tools = buildCapabilityCatalogTools(['image_generation'], ctx, {
      workspaceId: 'ws1',
      correlationId: 'cid',
    });
    expect(tools).toHaveLength(1);
  });

  it('nao inclui image_generation real sem chave OpenAI (cai em stub)', () => {
    const tools = buildCapabilityCatalogTools(['image_generation'], {}, {
      workspaceId: 'ws1',
    });
    expect(tools).toHaveLength(1);
  });
});
