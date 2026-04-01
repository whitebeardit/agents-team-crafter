/**
 * Segmentos de caminho seguros para galeria local por time (sem path traversal).
 */

const MAX_TEAM_FOLDER = 80;
const MAX_SUBJECT = 48;

/** Normaliza um segmento de pasta: minusculas, hifens, sem caracteres especiais. */
export function sanitizePathSegment(raw: string, maxLen: number): string {
  const s = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'item';
}

/** Pasta do time: nome sanitizado + sufixo do id para unicidade. */
export function teamFolderSegment(teamName: string, teamId: string): string {
  const idSuffix = teamId.replace(/[^a-f0-9]/gi, '').slice(-8);
  const namePart = sanitizePathSegment(teamName || 'time', MAX_TEAM_FOLDER - 10);
  return `${namePart}-${idSuffix || 'team'}`.slice(0, MAX_TEAM_FOLDER);
}

/** Assunto derivado do prompt (primeiras palavras). */
export function subjectSlugFromPrompt(prompt: string): string {
  const trimmed = prompt.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'sem-assunto';
  const words = trimmed.slice(0, 120).split(/\s+/).slice(0, 8).join(' ');
  return sanitizePathSegment(words, MAX_SUBJECT);
}

/** Verifica se resolvedPath é subcaminho estrito de baseDir (ambos absolutos). */
export function isPathInsideDir(baseDir: string, resolvedPath: string): boolean {
  const base = baseDir.endsWith('/') ? baseDir.slice(0, -1) : baseDir;
  const p = resolvedPath.endsWith('/') ? resolvedPath.slice(0, -1) : resolvedPath;
  return p === base || p.startsWith(`${base}/`);
}
