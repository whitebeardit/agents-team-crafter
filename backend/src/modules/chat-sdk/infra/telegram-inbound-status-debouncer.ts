import type { Thread } from 'chat';
import type { ITeamProgressEvent } from '../../team-runtime/domain/team-progress-event.js';

const DETAIL_MAX = 80;

export interface ITelegramInboundStatusDebouncerOptions {
  minIntervalMs?: number;
}

/**
 * Posts short PT status lines to Telegram while specialists run, at most once per interval.
 * Errors from the adapter are swallowed so inbound runs are not aborted.
 */
export class TelegramInboundStatusDebouncer {
  private lastSentAt = 0;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingText: string | null = null;

  constructor(
    private readonly thread: Thread,
    private readonly minIntervalMs: number,
  ) {}

  notifyFromProgress(e: ITeamProgressEvent): void {
    if (e.phase !== 'specialist' || e.status !== 'busy') return;
    const detail = e.detail?.trim();
    const text = detail
      ? `Em progresso: ${detail.length <= DETAIL_MAX ? detail : `${detail.slice(0, DETAIL_MAX - 1)}…`}`
      : 'A consultar especialista…';

    const now = Date.now();
    const elapsed = now - this.lastSentAt;
    if (elapsed >= this.minIntervalMs) {
      this.lastSentAt = now;
      void this.postSafe(text);
      return;
    }
    this.pendingText = text;
    if (this.pendingTimer) return;
    const wait = this.minIntervalMs - elapsed;
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      const toSend = this.pendingText;
      this.pendingText = null;
      if (!toSend) return;
      this.lastSentAt = Date.now();
      void this.postSafe(toSend);
    }, wait);
  }

  private async postSafe(text: string): Promise<void> {
    try {
      await this.thread.post(text);
    } catch {
      /* ignore Telegram errors */
    }
  }

  dispose(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingText = null;
  }
}

export function createTelegramInboundStatusDebouncer(
  thread: Thread,
  options?: ITelegramInboundStatusDebouncerOptions,
): TelegramInboundStatusDebouncer {
  const minIntervalMs = options?.minIntervalMs ?? 9000;
  return new TelegramInboundStatusDebouncer(thread, minIntervalMs);
}
