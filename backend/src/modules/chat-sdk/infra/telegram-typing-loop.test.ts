import { startTelegramTypingLoop } from './telegram-typing-loop.js';

describe('startTelegramTypingLoop', () => {
  it('returns noop when adapter has no startTyping', () => {
    const thread = {
      id: 't1',
      adapter: {},
    } as import('chat').Thread;
    const stop = startTelegramTypingLoop(thread);
    expect(typeof stop).toBe('function');
    stop();
  });
});
