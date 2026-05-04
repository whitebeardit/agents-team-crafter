import { describe, expect, it } from '@jest/globals';
import { createTeamLiveBroadcaster } from './team-live-broadcaster.js';

describe('TeamLiveBroadcaster (memory)', () => {
  it('entrega vaultNoteChanged ao subscriber', async () => {
    const b = createTeamLiveBroadcaster(null);
    const payloads: unknown[] = [];
    const unsub = await b.subscribe('ws1', 'team1', (env) => {
      if (env.event === 'vaultNoteChanged') payloads.push(env.data);
    });
    b.publish('ws1', 'team1', {
      source: 'manual',
      runId: 'vault-static',
      event: 'vaultNoteChanged',
      data: { workspaceId: 'ws1', noteId: 'n1', contentHash: 'h1', version: 3 },
    });
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual(
      expect.objectContaining({ noteId: 'n1', contentHash: 'h1', version: 3 }),
    );
    unsub();
  });
});
