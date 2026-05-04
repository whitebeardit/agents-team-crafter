/**
 * Slug legível para tags `party-slug/*` (não é identidade no filesystem).
 */
export function slugifyPartyName(displayName: string, maxLen = 60): string {
  const s = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
  return s.length > 0 ? s : 'party';
}
