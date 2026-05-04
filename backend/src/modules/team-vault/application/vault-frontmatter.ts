import { vaultNoteFrontmatterSchema, type TVaultNoteFrontmatter } from '../domain/vault-note-frontmatter.schema.js';

export function serializeNoteDocument(fm: TVaultNoteFrontmatter, bodyMarkdown: string): string {
  const json = JSON.stringify(fm, null, 2);
  return `---\n${json}\n---\n\n${bodyMarkdown.trim()}\n`;
}

export function parseNoteDocument(raw: string): { frontmatter: TVaultNoteFrontmatter; body: string } | null {
  if (!raw.startsWith('---\n')) return null;
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const jsonBlock = raw.slice(4, end).trim();
  const body = raw.slice(end + 5);
  try {
    const parsed = JSON.parse(jsonBlock) as unknown;
    const frontmatter = vaultNoteFrontmatterSchema.parse(parsed);
    return { frontmatter, body };
  } catch {
    return null;
  }
}
