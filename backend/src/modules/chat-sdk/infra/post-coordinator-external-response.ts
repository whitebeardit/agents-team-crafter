import type { Thread } from 'chat';
import type { IExternalResponse } from '../../team-runtime/domain/external-response.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const EMPTY_POST_FALLBACK = '(Sem texto na resposta.)';

type TInboundPlatform = string;

/** Duck-typed: avoids `instanceof` when duplicate @chat-adapter/shared copies exist in node_modules. */
function getRateLimitRetryAfterSeconds(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const o = err as { name?: string; retryAfter?: unknown };
  if (o.name !== 'AdapterRateLimitError') return null;
  if (typeof o.retryAfter !== 'number' || Number.isNaN(o.retryAfter)) return null;
  return o.retryAfter;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * One attempt to post; on 429, wait `retryAfter` (capped) and retry the same payload once.
 */
async function postThreadWith429Retry(thread: Thread, message: Parameters<Thread['post']>[0]): Promise<void> {
  try {
    await thread.post(message);
  } catch (err) {
    const sec = getRateLimitRetryAfterSeconds(err);
    if (sec === null) throw err;
    const ms = Math.min(Math.max(sec, 0) * 1000, 60_000);
    await sleepMs(ms);
    await thread.post(message);
  }
}

function logTelegramPostContext(
  phase: 'markdown_fallback' | 'empty_skip',
  detail: {
    textLength: number;
    format?: string;
    imageCount: number;
    err?: unknown;
  },
): void {
  const base = {
    phase,
    textLength: detail.textLength,
    format: detail.format ?? 'plain',
    imageCount: detail.imageCount,
  };
  if (detail.err !== undefined) {
    console.warn('[postCoordinatorExternalResponse] telegram', {
      ...base,
      error: detail.err instanceof Error ? detail.err.message : String(detail.err),
      errorName: detail.err instanceof Error ? detail.err.name : undefined,
    });
  } else {
    console.warn('[postCoordinatorExternalResponse] telegram', base);
  }
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() || 'image';
    if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(base)) return base.slice(0, 128);
  } catch {
    /* ignore */
  }
  return 'image.png';
}

function guessMimeFromFilename(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return undefined;
}

/**
 * Fetches a remote image over HTTPS for Telegram `sendDocument` (Chat SDK `files` payload).
 * Returns null on validation or network failure (caller falls back to text-only).
 */
export async function fetchHttpsImageAsFileUpload(
  url: string,
): Promise<{ data: Buffer; filename: string; mimeType: string } | null> {
  if (!url.startsWith('https://')) return null;
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const ct = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ct.startsWith('image/')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
  const filename = filenameFromUrl(url);
  const mimeType = ct || guessMimeFromFilename(filename) || 'image/png';
  return { data: buf, filename, mimeType: mimeType };
}

async function postTelegramTextOnly(
  thread: Thread,
  text: string,
  format: IExternalResponse['format'],
): Promise<void> {
  const normalized = (text ?? '').trim();
  const imageCount = 0;
  if (!normalized) {
    logTelegramPostContext('empty_skip', { textLength: 0, format, imageCount });
    await postThreadWith429Retry(thread, EMPTY_POST_FALLBACK);
    return;
  }

  if (format === 'markdown') {
    try {
      await postThreadWith429Retry(thread, { markdown: normalized });
    } catch (err) {
      logTelegramPostContext('markdown_fallback', {
        textLength: normalized.length,
        format: 'markdown',
        imageCount,
        err,
      });
      await postThreadWith429Retry(thread, normalized);
    }
    return;
  }

  await postThreadWith429Retry(thread, normalized);
}

async function postTelegramWithFirstImageFile(
  thread: Thread,
  body: string,
  format: IExternalResponse['format'],
  file: { data: Buffer; filename: string; mimeType: string },
): Promise<void> {
  const normalized = (body ?? '').trim();
  const captionForMarkdown = normalized || '\u2060'; /* word joiner so caption is non-empty if needed */
  const imageCount = 1;

  if (format === 'markdown') {
    try {
      await postThreadWith429Retry(thread, {
        markdown: captionForMarkdown,
        files: [{ data: file.data, filename: file.filename, mimeType: file.mimeType }],
      });
    } catch (err) {
      logTelegramPostContext('markdown_fallback', {
        textLength: normalized.length,
        format: 'markdown',
        imageCount,
        err,
      });
      await postThreadWith429Retry(thread, {
        raw: normalized || EMPTY_POST_FALLBACK,
        files: [{ data: file.data, filename: file.filename, mimeType: file.mimeType }],
      });
    }
    return;
  }

  await postThreadWith429Retry(thread, {
    raw: normalized || EMPTY_POST_FALLBACK,
    files: [{ data: file.data, filename: file.filename, mimeType: file.mimeType }],
  });
}

async function postTelegramImageOnly(thread: Thread, file: { data: Buffer; filename: string; mimeType: string }) {
  await postThreadWith429Retry(thread, {
    markdown: '\u2060',
    files: [{ data: file.data, filename: file.filename, mimeType: file.mimeType }],
  });
}

/**
 * Publishes coordinator output to a chat thread. For Telegram, image attachments are downloaded
 * and sent as file uploads (one per message). Other platforms receive markdown/plain text only.
 * Telegram: legacy Markdown often fails on code-heavy replies; we fall back to plain text without parse_mode.
 */
export async function postCoordinatorExternalResponse(
  thread: Thread,
  response: IExternalResponse,
  inboundPlatform: TInboundPlatform,
): Promise<void> {
  const { text, format, attachments } = response;
  const imageUrls =
    attachments?.filter((a) => a.type === 'image').map((a) => a.url.trim()).filter(Boolean) ?? [];
  const useFileUpload = inboundPlatform === 'telegram' && imageUrls.length > 0;

  if (inboundPlatform === 'telegram' && !useFileUpload) {
    await postTelegramTextOnly(thread, text, format);
    return;
  }

  if (!useFileUpload) {
    const normalized = (text ?? '').trim();
    if (!normalized) {
      await thread.post(EMPTY_POST_FALLBACK);
      return;
    }
    if (format === 'markdown') {
      await thread.post({ markdown: normalized });
    } else {
      await thread.post(normalized);
    }
    return;
  }

  const files: Array<{ data: Buffer; filename: string; mimeType: string }> = [];
  for (const url of imageUrls) {
    const file = await fetchHttpsImageAsFileUpload(url);
    if (file) files.push(file);
  }

  if (inboundPlatform === 'telegram') {
    if (files.length === 0) {
      await postTelegramTextOnly(thread, text, format);
      return;
    }

    const body = text ?? '';
    const first = files[0]!;
    await postTelegramWithFirstImageFile(thread, body, format, first);

    for (let i = 1; i < files.length; i++) {
      const f = files[i]!;
      await postTelegramImageOnly(thread, f);
    }
    return;
  }

  if (files.length === 0) {
    const normalized = (text ?? '').trim();
    if (!normalized) {
      await thread.post(EMPTY_POST_FALLBACK);
      return;
    }
    if (format === 'markdown') {
      await thread.post({ markdown: normalized });
    } else {
      await thread.post(normalized);
    }
    return;
  }

  const body = format === 'markdown' ? text : text;
  const first = files[0]!;
  await thread.post({
    markdown: body,
    files: [{ data: first.data, filename: first.filename, mimeType: first.mimeType }],
  });

  for (let i = 1; i < files.length; i++) {
    const f = files[i]!;
    await thread.post({
      markdown: '',
      files: [{ data: f.data, filename: f.filename, mimeType: f.mimeType }],
    });
  }
}
