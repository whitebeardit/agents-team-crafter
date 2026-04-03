import { TeamLiveBroadcaster } from './team-live-broadcaster.js';

describe('TeamLiveBroadcaster (memory)', () => {
  it('publish/subscribe delivers envelopes for the same team key', async () => {
    const b = new TeamLiveBroadcaster(undefined);
    const received: unknown[] = [];
    const unsub = await b.subscribe('ws1', 'teamA', (env) => {
      received.push(env);
    });
    b.publishAgentStatus('ws1', 'teamA', 'inbound', {
      runId: 'run-1',
      agentId: 'ag1',
      status: 'busy',
      phase: 'coordinator',
    });
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      source: 'inbound',
      runId: 'run-1',
      event: 'agentStatus',
      data: expect.objectContaining({ agentId: 'ag1' }),
    });
    unsub();
  });

  it('does not cross workspaces', async () => {
    const b = new TeamLiveBroadcaster(undefined);
    const received: unknown[] = [];
    await b.subscribe('ws1', 'teamA', (env) => received.push(env));
    b.publishAgentStatus('ws2', 'teamA', 'inbound', {
      runId: 'run-1',
      agentId: 'ag1',
      status: 'busy',
      phase: 'coordinator',
    });
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(0);
  });
});
