/**
 * Path-only deep links for a nota no WebUI (sem origin).
 * Usado por GET /vault/notes/:id/resolve e pelo plugin Obsidian.
 */
export function buildVaultNoteWebPath(row: { noteId: string; agentId: string; partyId?: string }): string {
  const nid = encodeURIComponent(row.noteId);
  if (row.partyId) {
    const pid = encodeURIComponent(row.partyId);
    return `/settings?tab=workspace&vaultParty=${pid}&vaultNote=${nid}`;
  }
  const aid = encodeURIComponent(row.agentId);
  return `/agents/${aid}?vaultTab=vault&vaultNote=${nid}`;
}

export function joinWebUiBaseUrl(baseUrl: string, webPath: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const path = webPath.startsWith('/') ? webPath : `/${webPath}`;
  return `${base}${path}`;
}
