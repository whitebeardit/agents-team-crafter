import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Thread } from 'chat';
import { postCoordinatorExternalResponse } from './post-coordinator-external-response.js';

function mockThread(postImpl: (msg: unknown) => Promise<void>): Thread {
  return { post: jest.fn(postImpl) } as unknown as Thread;
}

describe('postCoordinatorExternalResponse', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('telegram markdown: falls back to plain when first post throws', async () => {
    const calls: unknown[] = [];
    const thread = mockThread(async (msg) => {
      calls.push(msg);
      if (calls.length === 1) throw new Error('Bad Request: cant parse entities');
      await Promise.resolve();
    });

    await postCoordinatorExternalResponse(
      thread,
      { text: '**bold** `code`', format: 'markdown' },
      'telegram',
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ markdown: '**bold** `code`' });
    expect(calls[1]).toBe('**bold** `code`');
  });

  it('telegram: empty text posts fallback placeholder', async () => {
    const calls: unknown[] = [];
    const thread = mockThread(async (msg) => {
      calls.push(msg);
      await Promise.resolve();
    });

    await postCoordinatorExternalResponse(thread, { text: '   ', format: 'plain' }, 'telegram');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('(Sem texto na resposta.)');
  });

  it('telegram: retries once on rate limit duck-typed error', async () => {
    let n = 0;
    const thread = mockThread(async (msg) => {
      n += 1;
      if (n === 1) {
        const e = new Error('Rate limited');
        Object.assign(e, { name: 'AdapterRateLimitError', retryAfter: 0 });
        throw e;
      }
      await Promise.resolve();
      expect(msg).toBe('hello');
    });

    await postCoordinatorExternalResponse(thread, { text: 'hello', format: 'plain' }, 'telegram');

    expect(n).toBe(2);
  });

  it('slack: markdown without telegram fallback path', async () => {
    const calls: unknown[] = [];
    const thread = mockThread(async (msg) => {
      calls.push(msg);
      await Promise.resolve();
    });

    await postCoordinatorExternalResponse(thread, { text: 'Hi', format: 'markdown' }, 'slack');

    expect(calls).toEqual([{ markdown: 'Hi' }]);
  });
});
