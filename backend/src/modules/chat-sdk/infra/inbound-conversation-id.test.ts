import { buildInboundDebugConversationId } from './inbound-conversation-id.js';

describe('buildInboundDebugConversationId', () => {
  it('constrói id estável e curto: inbound:platform:thread', () => {
    const id = buildInboundDebugConversationId('telegram', 'u123-456');
    expect(id).toBe('inbound:telegram:u123-456');
    expect(id.length).toBeLessThanOrEqual(128);
  });

  it('normaliza label da plataforma (carateres inválidos)', () => {
    const id = buildInboundDebugConversationId('Google Chat', 't1');
    expect(id).toBe('inbound:google-chat:t1');
  });

  it('usado hash fixo de 64 hex quando o thread id excede o tamanho disponível', () => {
    const long = 'a'.repeat(200);
    const id = buildInboundDebugConversationId('telegram', long);
    expect(id.length).toBeLessThanOrEqual(128);
    expect(id.startsWith('inbound:telegram:')).toBe(true);
    const suffix = id.slice('inbound:telegram:'.length);
    expect(suffix).toHaveLength(64);
    const again = buildInboundDebugConversationId('telegram', long);
    expect(again).toBe(id);
  });

  it('trata thread vazia com placeholder', () => {
    const id = buildInboundDebugConversationId('slack', '  ');
    expect(id).toContain('no-thread');
    expect(id.length).toBeLessThanOrEqual(128);
  });
});
