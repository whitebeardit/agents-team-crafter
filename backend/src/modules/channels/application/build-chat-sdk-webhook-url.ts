import type { FastifyRequest } from 'fastify';

export function publicBaseUrl(req: FastifyRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost:3001';
  return `${proto}://${host}`;
}

export function buildChatSdkWebhookUrl(
  req: FastifyRequest,
  workspaceId: string,
  platform: string,
  channelId: string,
): string {
  const base = publicBaseUrl(req);
  if (platform === 'slack') {
    return `${base}/api/v1/webhooks/chat/${workspaceId}/slack`;
  }
  return `${base}/api/v1/webhooks/chat/${workspaceId}/${platform}/${channelId}`;
}
