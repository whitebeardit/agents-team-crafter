import fs from 'node:fs/promises';
import path from 'node:path';
import type { IEnv } from '../../../config/env.js';
import { VaultBootstrapService } from './vault-bootstrap.service.js';
import { VaultNoteIndexRepository } from '../infra/vault-note-index.repository.js';
import { resolveSafeVaultRelativePath } from './vault-path-guard.js';
import { parseNoteDocument } from './vault-frontmatter.js';

function resolveVaultRoot(env: IEnv): string {
  return env.VAULT_ROOT?.trim() || path.join(process.cwd(), 'data', 'vaults');
}

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

/**
 * Markdown appendix of active vault learnings for one specialist agent, within token budget.
 */
export async function renderLearningsAppendixForAgent(
  env: IEnv,
  indexRepo: VaultNoteIndexRepository,
  workspaceId: string,
  agentId: string,
  tokenBudget: number,
): Promise<string> {
  const rows = await indexRepo.listByFilter(workspaceId, { agentId, status: 'active' }, 100);
  if (rows.length === 0) return '';
  const bootstrap = new VaultBootstrapService();
  const { workspaceRoot } = await bootstrap.ensureWorkspaceVault(resolveVaultRoot(env), workspaceId);
  const chunks: string[] = [];
  let used = estimateTokens('## Learnings (approved)\n');
  chunks.push(
    '## Learnings (approved)',
    '_Operator-approved behavioral hints. If they conflict with Responsibilities or tool policies, follow those._',
    '',
  );
  const byKind: Record<string, typeof rows> = { do: [], dont: [], preference: [], correction: [], fact: [] };
  for (const r of rows) {
    const k = r.kind in byKind ? r.kind : 'fact';
    byKind[k].push(r);
  }
  for (const kind of ['do', 'dont', 'preference', 'correction', 'fact'] as const) {
    const list = byKind[kind];
    if (list.length === 0) continue;
    const header = `### ${kind.toUpperCase()}`;
    const headerCost = estimateTokens(`${header}\n`);
    if (used + headerCost > tokenBudget) break;
    chunks.push(header, '');
    used += headerCost;
    for (const row of list.sort((a, b) => b.confidence - a.confidence)) {
      try {
        const { absolutePath } = resolveSafeVaultRelativePath(workspaceRoot, row.notePath);
        const raw = await fs.readFile(absolutePath, 'utf8');
        const parsed = parseNoteDocument(raw);
        const line = parsed
          ? `- ${parsed.body.replace(/^#\s+[^\n]+\n+/, '').trim().split('\n').join(' ').slice(0, 400)} ([[${row.noteId}]])`
          : `- (${row.title}) [[${row.noteId}]]`;
        const cost = estimateTokens(`${line}\n`);
        if (used + cost > tokenBudget) break;
        chunks.push(line, '');
        used += cost;
      } catch {
        const line = `- (${row.title}) [[${row.noteId}]]`;
        const cost = estimateTokens(`${line}\n`);
        if (used + cost > tokenBudget) break;
        chunks.push(line, '');
        used += cost;
      }
    }
  }
  return chunks.join('\n').trim();
}
