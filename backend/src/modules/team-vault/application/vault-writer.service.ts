import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IEnv } from '../../../config/env.js';
import type { GovernanceAuditEventRepository } from '../../governance/infra/governance-audit-event.repository.js';
import { VaultBootstrapService } from './vault-bootstrap.service.js';
import { VaultLockRepository } from '../infra/vault-lock.repository.js';
import { VaultNoteIndexRepository, hashVaultContent } from '../infra/vault-note-index.repository.js';
import { resolveSafeVaultRelativePath, resolveVaultWorkspaceRoot } from './vault-path-guard.js';
import { serializeNoteDocument, parseNoteDocument } from './vault-frontmatter.js';
import {
  normalizeVaultTags,
  vaultNoteFrontmatterSchema,
  vaultNoteKindSchema,
  type TVaultNoteFrontmatter,
} from '../domain/vault-note-frontmatter.schema.js';
import { redactPii } from './pii-redactor.js';
import type { z } from 'zod';
import { tryGetHeadCommit, tryGitCommit } from './vault-git.js';

type TKind = z.infer<typeof vaultNoteKindSchema>;

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

function resolveVaultRoot(env: IEnv): string {
  return env.VAULT_ROOT?.trim() || path.join(process.cwd(), 'data', 'vaults');
}

export class VaultWriterService {
  private readonly bootstrap = new VaultBootstrapService();

  constructor(
    private readonly env: IEnv,
    private readonly lockRepo: VaultLockRepository,
    private readonly indexRepo: VaultNoteIndexRepository,
    private readonly governanceAuditRepo?: GovernanceAuditEventRepository,
  ) {}

  getHeadCommit(workspaceId: string): string | null {
    const root = resolveVaultWorkspaceRoot(resolveVaultRoot(this.env), workspaceId);
    return tryGetHeadCommit(root);
  }

  async proposeNote(input: {
    workspaceId: string;
    agentId: string;
    kind: TKind;
    title: string;
    body: string;
    createdBy: 'summarizer' | 'operator' | 'librarian';
    quote?: string;
    runId?: string;
    conversationId?: string;
    confidence?: number;
    userId?: string;
  }): Promise<{ noteId: string; notePath: string; gitCommit: string | null }> {
    const vaultRoot = resolveVaultRoot(this.env);
    const holder = `writer:${randomUUID()}`;
    const acquired = await this.lockRepo.acquire(input.workspaceId, holder, 45_000);
    if (!acquired) throw new Error('VAULT_LOCK_UNAVAILABLE');

    try {
      const { workspaceRoot } = await this.bootstrap.ensureWorkspaceVault(vaultRoot, input.workspaceId);
      const noteId = randomUUID();
      const safeTitle = redactPii(input.title.trim().slice(0, 200));
      const safeBody = redactPii(input.body.trim());
      const safeQuote = input.quote ? redactPii(input.quote.trim().slice(0, 2000)) : undefined;
      const fm: TVaultNoteFrontmatter = vaultNoteFrontmatterSchema.parse({
        id: noteId,
        agent: input.agentId,
        kind: input.kind,
        status: 'proposed',
        confidence: input.confidence ?? 0.5,
        source: {
          createdBy: input.createdBy,
          ...(input.runId ? { runId: input.runId } : {}),
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
          ...(safeQuote ? { quote: safeQuote } : {}),
        },
        version: 1,
        tokens: estimateTokens(safeBody + safeTitle),
        tags: normalizeVaultTags({
          agentId: input.agentId,
          kind: input.kind,
          status: 'proposed',
          createdBy: input.createdBy,
        }),
        created_at: new Date().toISOString(),
      });
      const mdBody = [`# ${safeTitle}`, '', safeBody].join('\n');
      const doc = serializeNoteDocument(fm, mdBody);
      const rel = `agents/${input.agentId}/learnings/${noteId}.md`;
      const { absolutePath } = resolveSafeVaultRelativePath(workspaceRoot, rel);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, doc, 'utf8');
      const hash = hashVaultContent(doc);
      const gitCommit = tryGitCommit(workspaceRoot, `vault: propose ${input.kind} ${noteId.slice(0, 8)}`);
      await this.indexRepo.upsert(input.workspaceId, {
        agentId: input.agentId,
        noteId,
        notePath: rel,
        status: 'proposed',
        kind: input.kind,
        tags: fm.tags,
        confidence: fm.confidence ?? 0,
        tokens: fm.tokens ?? estimateTokens(doc),
        version: 1,
        contentHash: hash,
        title: safeTitle,
        bodyPreview: safeBody.slice(0, 500),
        supersedesNoteId: fm.supersedes,
        lastGitCommit: gitCommit ?? undefined,
      });
      await this.governanceAuditRepo?.append({
        workspaceId: input.workspaceId,
        userId: input.userId,
        eventType: 'governance.team_vault_note_proposed',
        payload: { noteId, notePath: rel, kind: input.kind, gitCommit },
      });
      return { noteId, notePath: rel, gitCommit };
    } finally {
      await this.lockRepo.release(input.workspaceId, holder);
    }
  }

  async setNoteStatus(input: {
    workspaceId: string;
    noteId: string;
    status: 'active' | 'rejected' | 'archived';
    userId?: string;
  }): Promise<{ notePath: string; gitCommit: string | null }> {
    const vaultRoot = resolveVaultRoot(this.env);
    const holder = `writer:${randomUUID()}`;
    const acquired = await this.lockRepo.acquire(input.workspaceId, holder, 45_000);
    if (!acquired) throw new Error('VAULT_LOCK_UNAVAILABLE');
    try {
      const rows = await this.indexRepo.listByFilter(input.workspaceId, {}, 5000);
      const row = rows.find((r) => r.noteId === input.noteId);
      if (!row) throw new Error('NOTE_NOT_FOUND');
      const { workspaceRoot } = await this.bootstrap.ensureWorkspaceVault(vaultRoot, input.workspaceId);
      const { absolutePath } = resolveSafeVaultRelativePath(workspaceRoot, row.notePath);
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = parseNoteDocument(raw);
      if (!parsed) throw new Error('INVALID_NOTE');
      const fm = { ...parsed.frontmatter, status: input.status };
      if (input.status === 'active') {
        fm.approved = { by: input.userId ?? 'system', at: new Date().toISOString() };
      }
      fm.tags = normalizeVaultTags({
        agentId: row.agentId,
        kind: row.kind as TKind,
        status: input.status,
        createdBy: parsed.frontmatter.source.createdBy,
      });
      const doc = serializeNoteDocument(vaultNoteFrontmatterSchema.parse(fm), parsed.body.trim());
      await fs.writeFile(absolutePath, doc, 'utf8');
      const hash = hashVaultContent(doc);
      const gitCommit = tryGitCommit(workspaceRoot, `vault: ${input.status} ${input.noteId.slice(0, 8)}`);
      await this.indexRepo.upsert(input.workspaceId, {
        agentId: row.agentId,
        noteId: row.noteId,
        notePath: row.notePath,
        status: input.status,
        kind: row.kind,
        tags: fm.tags,
        confidence: fm.confidence ?? 0,
        tokens: fm.tokens ?? estimateTokens(doc),
        version: fm.version ?? 1,
        contentHash: hash,
        title: row.title,
        bodyPreview: row.bodyPreview,
        lastGitCommit: gitCommit ?? undefined,
      });
      await this.governanceAuditRepo?.append({
        workspaceId: input.workspaceId,
        userId: input.userId,
        eventType:
          input.status === 'active'
            ? 'governance.team_vault_note_approved'
            : input.status === 'rejected'
              ? 'governance.team_vault_note_rejected'
              : 'governance.team_vault_note_archived',
        payload: { noteId: input.noteId, notePath: row.notePath, gitCommit },
      });
      return { notePath: row.notePath, gitCommit };
    } finally {
      await this.lockRepo.release(input.workspaceId, holder);
    }
  }

  async readNoteRaw(workspaceId: string, notePath: string): Promise<string> {
    const vaultRoot = resolveVaultRoot(this.env);
    const { workspaceRoot } = await this.bootstrap.ensureWorkspaceVault(vaultRoot, workspaceId);
    const { absolutePath } = resolveSafeVaultRelativePath(workspaceRoot, notePath);
    return fs.readFile(absolutePath, 'utf8');
  }
}
