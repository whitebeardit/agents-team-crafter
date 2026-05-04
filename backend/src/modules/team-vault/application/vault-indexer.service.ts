import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import type { IEnv } from '../../../config/env.js';
import { VaultBootstrapService } from './vault-bootstrap.service.js';
import { VaultNoteIndexRepository, hashVaultContent } from '../infra/vault-note-index.repository.js';
import { parseNoteDocument } from './vault-frontmatter.js';
import { tryGetHeadCommit } from './vault-git.js';

function resolveVaultRoot(env: IEnv): string {
  return env.VAULT_ROOT?.trim() || path.join(process.cwd(), 'data', 'vaults');
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkMarkdownFiles(p)));
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

export class VaultIndexerService {
  private readonly bootstrap = new VaultBootstrapService();

  constructor(
    private readonly env: IEnv,
    private readonly indexRepo: VaultNoteIndexRepository,
  ) {}

  /** Full reindex from filesystem into Mongo (idempotent). */
  async reindexWorkspace(workspaceId: string): Promise<{ indexed: number }> {
    const vaultRoot = resolveVaultRoot(this.env);
    const { workspaceRoot } = await this.bootstrap.ensureWorkspaceVault(vaultRoot, workspaceId);
    const agentsDir = path.join(workspaceRoot, 'agents');
    const files = await walkMarkdownFiles(agentsDir);
    const gitHead = tryGetHeadCommit(workspaceRoot);
    let n = 0;
    for (const abs of files) {
      const rel = path.relative(workspaceRoot, abs).split(path.sep).join('/');
      if (!rel.startsWith('agents/')) continue;
      const raw = await fs.readFile(abs, 'utf8');
      const parsed = parseNoteDocument(raw);
      if (!parsed) continue;
      const fm = parsed.frontmatter;
      const parts = rel.split('/');
      const agentId = parts[1] ?? '';
      if (!agentId) continue;
      const titleMatch = parsed.body.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1]?.trim() ?? rel;
      await this.indexRepo.upsert(workspaceId, {
        agentId,
        noteId: fm.id,
        notePath: rel,
        status: fm.status,
        kind: fm.kind,
        tags: fm.tags,
        confidence: fm.confidence ?? 0,
        tokens: fm.tokens ?? Math.ceil(raw.length / 4),
        version: fm.version ?? 1,
        supersedesNoteId: fm.supersedes,
        contentHash: hashVaultContent(raw),
        title,
        bodyPreview: parsed.body.trim().slice(0, 500),
        lastGitCommit: gitHead ?? undefined,
      });
      n += 1;
    }
    return { indexed: n };
  }
}
