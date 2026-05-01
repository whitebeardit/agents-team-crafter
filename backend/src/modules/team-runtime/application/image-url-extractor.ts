const MARKDOWN_IMAGE_URL_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const HTTPS_URL_RE = /\bhttps:\/\/[^\s)]+/g;

function sanitizeUrlCandidate(raw: string): string {
  return raw.trim().replace(/[),.;:!?]+$/g, '');
}

export function dedupeHttpsImageUrls(urls: readonly string[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = sanitizeUrlCandidate(raw);
    if (!u.startsWith('https://')) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

export function extractImageUrlsFromText(raw: string, max = 8): string[] {
  if (!raw.trim()) return [];
  const markdownHits = Array.from(raw.matchAll(MARKDOWN_IMAGE_URL_RE)).map((m) => m[1] ?? '');
  const urlHits = Array.from(raw.matchAll(HTTPS_URL_RE)).map((m) => m[0] ?? '');
  return dedupeHttpsImageUrls([...markdownHits, ...urlHits], max);
}
