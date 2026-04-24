import { describe, expect, it } from '@jest/globals';
import { resolveChannelHintToProductType } from './product-channel-type.js';

describe('resolveChannelHintToProductType', () => {
  it('mapeia Web/App e API interna para api', () => {
    expect(resolveChannelHintToProductType('Web/App')).toBe('api');
    expect(resolveChannelHintToProductType('API interna')).toBe('api');
  });

  it('aceita slugs canónicos', () => {
    expect(resolveChannelHintToProductType('whatsapp')).toBe('whatsapp');
    expect(resolveChannelHintToProductType('Telegram')).toBe('telegram');
  });

  it('retorna undefined para texto não reconhecido', () => {
    expect(resolveChannelHintToProductType('Canal proprietário XPTO')).toBeUndefined();
  });
});
