import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Thread } from 'chat';
import type { ITeamProgressEvent } from '../../team-runtime/domain/team-progress-event.js';
import { TelegramInboundStatusDebouncer } from './telegram-inbound-status-debouncer.js';

function specialistBusy(detail: string): ITeamProgressEvent {
  return {
    runId: 'r1',
    agentId: 'a1',
    status: 'busy',
    phase: 'specialist',
    detail,
  };
}

describe('TelegramInboundStatusDebouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts immediately on first specialist busy', async () => {
    const post = jest.fn(async () => {});
    const thread = { post } as unknown as Thread;
    const d = new TelegramInboundStatusDebouncer(thread, 9000);
    d.notifyFromProgress(specialistBusy('task'));
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.stringContaining('task'));
    d.dispose();
  });

  it('debounces second post within interval and sends latest detail', async () => {
    const post = jest.fn(async () => {});
    const thread = { post } as unknown as Thread;
    const d = new TelegramInboundStatusDebouncer(thread, 9000);
    d.notifyFromProgress(specialistBusy('one'));
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    d.notifyFromProgress(specialistBusy('two'));
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9000);
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(expect.stringContaining('two'));
    d.dispose();
  });

  it('dispose clears pending timer without extra post', async () => {
    const post = jest.fn(async () => {});
    const thread = { post } as unknown as Thread;
    const d = new TelegramInboundStatusDebouncer(thread, 9000);
    d.notifyFromProgress(specialistBusy('one'));
    await Promise.resolve();
    d.notifyFromProgress(specialistBusy('two'));
    d.dispose();
    jest.advanceTimersByTime(9000);
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('ignores non-specialist phases', () => {
    const post = jest.fn(async () => {});
    const thread = { post } as unknown as Thread;
    const d = new TelegramInboundStatusDebouncer(thread, 9000);
    const e: ITeamProgressEvent = {
      runId: 'r1',
      agentId: 'a1',
      status: 'busy',
      phase: 'coordinator',
      detail: 'x',
    };
    d.notifyFromProgress(e);
    expect(post).not.toHaveBeenCalled();
    d.dispose();
  });
});
