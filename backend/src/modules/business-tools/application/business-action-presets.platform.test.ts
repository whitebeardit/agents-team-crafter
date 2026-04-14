import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets (platform/admin)', () => {
  it('exposes explicit schema for business.ping', () => {
    const ping = getBusinessActionPreset('business.ping');
    expect(ping?.packId).toBe('platform');
    expect((ping?.inputSchema as { properties?: Record<string, unknown> })?.properties).toHaveProperty(
      'message',
    );
  });

  it('exposes explicit schema for platform_status_overview', () => {
    const status = getBusinessActionPreset('platform_status_overview');
    expect(status?.packId).toBe('platform');
    expect(
      (status?.inputSchema as { properties?: Record<string, unknown> })?.properties,
    ).toHaveProperty('includeTimestamp');
  });
});
