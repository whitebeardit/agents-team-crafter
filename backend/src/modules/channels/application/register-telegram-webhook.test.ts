import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { registerTelegramWebhookWithTelegramApi } from './register-telegram-webhook.js';

describe('registerTelegramWebhookWithTelegramApi', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envia setWebhook com secret_token quando definido', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const u = String(url);
      if (u.includes('setWebhook')) {
        return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
      }
      if (u.includes('getWebhookInfo')) {
        return new Response(JSON.stringify({ ok: true, result: { url: 'https://x/y' } }), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    }) as typeof fetch;

    const out = await registerTelegramWebhookWithTelegramApi(
      'TOKEN',
      'https://host/api/v1/webhooks/chat/ws/telegram/ch',
      '  sec  ',
    );

    expect(out.setWebhook.ok).toBe(true);
    expect(out.webhookInfo.ok).toBe(true);
    expect(calls).toHaveLength(2);
    const body = JSON.parse((calls[0].init?.body as string) ?? '{}') as {
      url: string;
      secret_token?: string;
    };
    expect(body.url).toBe('https://host/api/v1/webhooks/chat/ws/telegram/ch');
    expect(body.secret_token).toBe('sec');
  });

  it('omite secret_token quando vazio', async () => {
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('setWebhook')) {
        const body = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>;
        expect(body.secret_token).toBeUndefined();
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }) as typeof fetch;

    await registerTelegramWebhookWithTelegramApi('T', 'https://u', undefined);
    await registerTelegramWebhookWithTelegramApi('T', 'https://u', '   ');
  });
});
