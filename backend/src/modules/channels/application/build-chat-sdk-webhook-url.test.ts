import { describe, expect, it } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import { buildChatSdkWebhookUrl, publicBaseUrl } from './build-chat-sdk-webhook-url.js';

function req(headers: Record<string, string | undefined>): FastifyRequest {
  return { headers } as FastifyRequest;
}

describe('publicBaseUrl', () => {
  it('usa x-forwarded-proto e host', () => {
    expect(publicBaseUrl(req({ host: 'api.example.com', 'x-forwarded-proto': 'https' }))).toBe(
      'https://api.example.com',
    );
  });

  it('fallback http e localhost:3001 sem headers', () => {
    expect(publicBaseUrl(req({}))).toBe('http://localhost:3001');
  });
});

describe('buildChatSdkWebhookUrl', () => {
  const r = req({ host: 'h.test', 'x-forwarded-proto': 'https' });

  it('slack omite channelId no path', () => {
    expect(buildChatSdkWebhookUrl(r, 'ws1', 'slack', 'ch99')).toBe(
      'https://h.test/api/v1/webhooks/chat/ws1/slack',
    );
  });

  it('telegram inclui workspace platform e channelId', () => {
    expect(buildChatSdkWebhookUrl(r, 'ws1', 'telegram', 'ch99')).toBe(
      'https://h.test/api/v1/webhooks/chat/ws1/telegram/ch99',
    );
  });
});
