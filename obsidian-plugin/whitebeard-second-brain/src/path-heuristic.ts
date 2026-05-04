/** Espelha `buildVaultNoteWebPath` do backend com base no caminho relativo no vault. */
export function buildWebPathFromVaultFile(vaultRelativePath: string, noteId: string): string | null {
  const id = encodeURIComponent(noteId);
  if (vaultRelativePath.includes("parties/")) {
    const m = vaultRelativePath.match(/parties\/([^/]+)\//);
    const partyId = m?.[1];
    if (partyId) {
      return `/settings?tab=workspace&vaultParty=${encodeURIComponent(partyId)}&vaultNote=${id}`;
    }
  }
  const m2 = vaultRelativePath.match(/agents\/([^/]+)\//);
  const agentId = m2?.[1];
  if (agentId) {
    return `/agents/${encodeURIComponent(agentId)}?vaultTab=vault&vaultNote=${id}`;
  }
  return null;
}
