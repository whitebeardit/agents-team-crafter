import type { Thread } from 'chat';
import type { IExternalResponse } from '../../team-runtime/domain/external-response.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

type TInboundPlatform = string;

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
  return { data: buf, filename, mimeType };
}

/**
 * Publishes coordinator output to a chat thread. For Telegram, image attachments are downloaded
 * and sent as file uploads (one per message). Other platforms receive markdown/plain text only.
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

  if (!useFileUpload) {
    if (format === 'markdown') {
      await thread.post({ markdown: text });
    } else {
      await thread.post(text);
    }
    return;
  }

  const files: Array<{ data: Buffer; filename: string; mimeType: string }> = [];
  for (const url of imageUrls) {
    const file = await fetchHttpsImageAsFileUpload(url);
    if (file) files.push(file);
  }

  if (files.length === 0) {
    if (format === 'markdown') {
      await thread.post({ markdown: text });
    } else {
      await thread.post(text);
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
