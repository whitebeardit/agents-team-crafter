import type { Thread } from 'chat';

/**
 * Renews Telegram "typing" while the coordinator/specialists run (sendChatAction via adapter).
 * Call the returned function when the run finishes or fails.
 */
export function startTelegramTypingLoop(thread: Thread): () => void {
  const adapter = thread.adapter as { startTyping?: (threadId: string) => Promise<void> };
  if (typeof adapter.startTyping !== 'function') {
    return () => {};
  }
  let cancelled = false;
  const loop = async () => {
    while (!cancelled) {
      try {
        await adapter.startTyping!(thread.id);
      } catch {
        /* ignore API errors */
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };
  void loop();
  return () => {
    cancelled = true;
  };
}
