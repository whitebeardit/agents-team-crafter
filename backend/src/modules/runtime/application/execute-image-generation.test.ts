import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import { resetTeamGalleryServiceForTests } from '../../teams/application/team-gallery.service.js';
import { executeImageGeneration } from './tool-builtin-executors.js';

describe('executeImageGeneration', () => {
  const origFetch = globalThis.fetch;
  let tmpGallery: string | undefined;

  afterEach(async () => {
    globalThis.fetch = origFetch;
    resetTeamGalleryServiceForTests();
    delete process.env.MEDIA_GALLERY_ROOT;
    if (tmpGallery) {
      await rm(tmpGallery, { recursive: true, force: true }).catch(() => undefined);
      tmpGallery = undefined;
    }
  });

  it('returns guidance when OpenAI key is missing', async () => {
    const ctx: IToolIntegrationContext = {};
    const r = await executeImageGeneration(ctx, { prompt: 'x', model: 'default' }, { workspaceId: 'ws' });
    expect(r).toContain('configure chave OpenAI');
  });

  it('returns Markdown image line on success (DALL-E 3)', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ url: 'https://cdn.openai.com/example.png' }],
        }),
    })) as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    const r = await executeImageGeneration(
      ctx,
      { prompt: 'A blue circle', model: 'dall-e-3', size: '1024x1024' },
      { workspaceId: 'ws' },
    );
    expect(r).toContain('![Imagem gerada](https://cdn.openai.com/example.png)');
    expect(r).toContain('DALL-E 3');
  });

  it('defaults to 1024x1024 when size is omitted (DALL-E 3)', async () => {
    const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      expect(body.size).toBe('1024x1024');
      expect(body.model).toBe('dall-e-3');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.openai.com/x.png' }] }),
      };
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    await executeImageGeneration(ctx, { prompt: 'test', model: 'dall-e-3' }, { workspaceId: 'ws' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses explicit valid size in request body (DALL-E 3)', async () => {
    const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      expect(body.size).toBe('1792x1024');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.openai.com/wide.png' }] }),
      };
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    await executeImageGeneration(
      ctx,
      { prompt: 'wide', size: '1792x1024', model: 'dall-e-3' },
      { workspaceId: 'ws' },
    );
  });

  it('falls back to 1024x1024 when size is invalid for DALL-E 3', async () => {
    const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      expect(body.size).toBe('1024x1024');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.openai.com/fb.png' }] }),
      };
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    await executeImageGeneration(
      ctx,
      { prompt: 'x', size: '400x400', model: 'dall-e-3' },
      { workspaceId: 'ws' },
    );
  });

  it('uses DALL-E 2 with smaller default size when size omitted', async () => {
    const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      expect(body.model).toBe('dall-e-2');
      expect(body.size).toBe('256x256');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.openai.com/s.png' }] }),
      };
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    await executeImageGeneration(ctx, { prompt: 'test', model: 'dall-e-2' }, { workspaceId: 'ws' });
  });

  it('resolve model default via workspace defaultImageModel', async () => {
    const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      expect(body.model).toBe('dall-e-2');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.openai.com/x.png' }] }),
      };
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = {
      openai: { apiKey: 'sk-test', defaultImageModel: 'dall-e-2' },
    };
    await executeImageGeneration(
      ctx,
      { prompt: 'x', model: 'default', size: '256x256' },
      { workspaceId: 'ws' },
    );
  });

  it('persists gallery copy when teamContext is set', async () => {
    tmpGallery = await mkdtemp(join(tmpdir(), 'gallery-'));
    process.env.MEDIA_GALLERY_ROOT = tmpGallery;
    resetTeamGalleryServiceForTests();

    globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('api.openai.com')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: [{ url: 'https://cdn.openai.com/example.png' }],
            }),
        };
      }
      if (u.includes('cdn.openai.com')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
        };
      }
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;

    const ctx: IToolIntegrationContext = { openai: { apiKey: 'sk-test' } };
    const r = await executeImageGeneration(
      ctx,
      { prompt: 'A blue circle', model: 'dall-e-3', size: '1024x1024' },
      {
        workspaceId: 'ws',
        teamContext: { teamId: '507f1f77bcf86cd799439011', teamName: 'Time Teste' },
      },
    );
    expect(r).toContain('Copia guardada na galeria');
    expect(r).toContain('![Imagem gerada](https://cdn.openai.com/example.png)');
  });
});
