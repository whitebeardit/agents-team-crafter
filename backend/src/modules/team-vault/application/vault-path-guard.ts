import path from 'node:path';

export function resolveVaultWorkspaceRoot(vaultRoot: string, workspaceId: string): string {
  const wid = workspaceId.replace(/[^a-f0-9]/gi, '');
  if (wid.length !== 24) throw new Error('INVALID_WORKSPACE_ID');
  return path.resolve(vaultRoot, wid);
}

/** Resolve a path inside the workspace vault; rejects traversal outside workspace root. */
export function resolveSafeVaultRelativePath(
  workspaceRoot: string,
  relativePath: string,
): { absolutePath: string; relativePosix: string } {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.startsWith('..')) throw new Error('PATH_TRAVERSAL');
  const absolute = path.resolve(workspaceRoot, normalized);
  const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : `${workspaceRoot}${path.sep}`;
  if (absolute !== workspaceRoot && !absolute.startsWith(rootWithSep)) {
    throw new Error('PATH_TRAVERSAL');
  }
  const relativePosix = normalized.split(path.sep).join('/');
  return { absolutePath: absolute, relativePosix };
}
