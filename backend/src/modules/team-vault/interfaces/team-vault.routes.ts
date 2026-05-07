import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Dirent } from 'node:fs';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { resolveVaultWorkspaceRoot } from '../application/vault-path-guard.js';
import { parseNoteDocument } from '../application/vault-frontmatter.js';
import { buildVaultNoteWebPath } from '../application/vault-web-path.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const listQuerySchema = z.object({
  status: z.enum(['proposed', 'active', 'archived', 'rejected']).optional(),
  agentId: z.string().optional(),
  teamId: z.string().optional(),
  partyId: z.string().optional(),
  partySlug: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const updateNoteBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(200_000),
});

function readIfMatchHeader(req: FastifyRequest): string | undefined {
  const h = req.headers['if-match'];
  const raw = Array.isArray(h) ? h[0] : h;
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t || t === '*') return undefined;
  return t.replace(/^W\//i, '').replace(/^"+|"+$/g, '').trim() || undefined;
}

async function publishVaultNoteChanged(
  deps: IAppDeps,
  workspaceId: string,
  payload: { noteId: string; contentHash: string; version: number },
): Promise<void> {
  try {
    const teamIds = await deps.teamRepo.listAllTeamIds(workspaceId);
    for (const teamId of teamIds) {
      deps.teamLiveBroadcaster.publish(workspaceId, teamId, {
        source: 'manual',
        runId: 'vault-static',
        event: 'vaultNoteChanged',
        data: { workspaceId, ...payload },
      });
    }
  } catch {
    /* ignore */
  }
}

export async function registerTeamVaultRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/vault/parties/:partyId/notes', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const partyId = (req.params as { partyId: string }).partyId;
    const q = listQuerySchema.parse(req.query);
    const rows = await deps.vaultNoteIndexRepo.listByFilter(
      ws,
      {
        partyId,
        ...(q.status ? { status: q.status } : {}),
      },
      q.limit ?? 50,
    );
    return reply.send(successEnvelope(rows));
  });

  app.get('/vault/notes', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuerySchema.parse(req.query);
    let agentIds: string[] | undefined;
    if (!q.agentId?.trim() && q.teamId?.trim()) {
      const team = (await deps.teamRepo.findById(ws, q.teamId.trim())) as {
        agentIds?: string[];
      } | null;
      const ids = Array.isArray(team?.agentIds) ? team.agentIds.filter((x) => typeof x === 'string' && x.trim()) : [];
      agentIds = ids.length > 0 ? ids : ['__no_team_agents__'];
    }
    const rows = await deps.vaultNoteIndexRepo.listByFilter(
      ws,
      {
        ...(q.status ? { status: q.status } : {}),
        ...(q.agentId?.trim() ? { agentId: q.agentId.trim() } : {}),
        ...(!q.agentId?.trim() && agentIds ? { agentIds } : {}),
        ...(q.partyId ? { partyId: q.partyId } : {}),
        ...(q.partySlug ? { partySlug: q.partySlug } : {}),
      },
      q.limit ?? 50,
    );
    return reply.send(successEnvelope(rows));
  });

  app.get('/vault/notes/:noteId/resolve', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const row = await deps.vaultNoteIndexRepo.findByNoteId(ws, noteId);
    if (!row) throw new AppError('NOT_FOUND', 'Nota nao encontrada no indice', 404, {});
    return reply.send(
      successEnvelope({
        workspaceId: ws,
        agentId: row.agentId,
        partyId: row.partyId,
        partySlug: row.partySlug,
        status: row.status,
        noteId: row.noteId,
        notePath: row.notePath,
        webPath: buildVaultNoteWebPath(row),
      }),
    );
  });

  app.get('/vault/notes/:noteId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const row = await deps.vaultNoteIndexRepo.findByNoteId(ws, noteId);
    if (!row) throw new AppError('NOT_FOUND', 'Nota nao encontrada no indice', 404, {});
    const raw = await deps.vaultWriter.readNoteRaw(ws, row.notePath);
    const parsed = parseNoteDocument(raw);
    if (!parsed) throw new AppError('INVALID_NOTE', 'Markdown da nota invalido', 422, {});
    return reply.send(
      successEnvelope({
        noteId: row.noteId,
        notePath: row.notePath,
        contentHash: row.contentHash,
        version: row.version,
        status: row.status,
        agentId: row.agentId,
        partyId: row.partyId,
        partySlug: row.partySlug,
        raw,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
      }),
    );
  });

  app.put('/vault/notes/:noteId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const ifMatch = readIfMatchHeader(req);
    if (!ifMatch) {
      throw new AppError('PRECONDITION_REQUIRED', 'If-Match com contentHash e obrigatorio para editar a nota.', 428, {});
    }
    const body = updateNoteBodySchema.parse(req.body);
    try {
      const r = await deps.vaultWriter.updateNoteContent({
        workspaceId: ws,
        noteId,
        expectedContentHash: ifMatch,
        title: body.title,
        body: body.body,
        userId: req.user?.sub,
      });
      await deps.vaultIndexer.reindexWorkspace(ws);
      await publishVaultNoteChanged(deps, ws, {
        noteId,
        contentHash: r.contentHash,
        version: r.version,
      });
      return reply.send(successEnvelope(r));
    } catch (e) {
      if (e instanceof AppError && e.code === 'PRECONDITION_FAILED') throw e;
      if (e instanceof Error && e.message === 'NOTE_NOT_FOUND') {
        throw new AppError('NOT_FOUND', 'Nota nao encontrada', 404, {});
      }
      throw e;
    }
  });

  app.get('/vault/note', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const pathParam = z.object({ path: z.string().min(1) }).parse(req.query).path;
    const raw = await deps.vaultWriter.readNoteRaw(ws, pathParam);
    return reply.send(successEnvelope({ path: pathParam, content: raw }));
  });

  app.put('/vault/notes/:noteId/approve', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const ifMatch = readIfMatchHeader(req);
    const r = await deps.vaultWriter.setNoteStatus({
      workspaceId: ws,
      noteId,
      status: 'active',
      userId: req.user?.sub,
      ...(ifMatch ? { ifMatch } : {}),
    });
    await deps.vaultIndexer.reindexWorkspace(ws);
    const row = await deps.vaultNoteIndexRepo.findByNoteId(ws, noteId);
    if (row) {
      await publishVaultNoteChanged(deps, ws, {
        noteId,
        contentHash: row.contentHash,
        version: row.version,
      });
    }
    return reply.send(successEnvelope(r));
  });

  app.put('/vault/notes/:noteId/reject', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const ifMatch = readIfMatchHeader(req);
    const r = await deps.vaultWriter.setNoteStatus({
      workspaceId: ws,
      noteId,
      status: 'rejected',
      userId: req.user?.sub,
      ...(ifMatch ? { ifMatch } : {}),
    });
    await deps.vaultIndexer.reindexWorkspace(ws);
    const row = await deps.vaultNoteIndexRepo.findByNoteId(ws, noteId);
    if (row) {
      await publishVaultNoteChanged(deps, ws, {
        noteId,
        contentHash: row.contentHash,
        version: row.version,
      });
    }
    return reply.send(successEnvelope(r));
  });

  app.delete('/vault/notes/:noteId', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const ifMatch = readIfMatchHeader(req);
    let snapshot: { noteId: string; contentHash: string; version: number } | null = null;
    try {
      const rowBefore = await deps.vaultNoteIndexRepo.findByNoteId(ws, noteId);
      if (rowBefore) {
        snapshot = { noteId, contentHash: rowBefore.contentHash, version: rowBefore.version };
      }
      const r = await deps.vaultWriter.deleteNote({
        workspaceId: ws,
        noteId,
        userId: req.user?.sub,
        ...(ifMatch ? { ifMatch } : {}),
      });
      await deps.vaultIndexer.reindexWorkspace(ws);
      if (snapshot) {
        await publishVaultNoteChanged(deps, ws, snapshot);
      }
      return reply.send(successEnvelope(r));
    } catch (e) {
      if (e instanceof Error && e.message === 'NOTE_NOT_FOUND') {
        throw new AppError('NOT_FOUND', 'Nota nao encontrada', 404, {});
      }
      throw e;
    }
  });

  app.post('/vault/reindex', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const r = await deps.vaultIndexer.reindexWorkspace(ws);
    return reply.send(successEnvelope(r));
  });

  app.get('/vault/git-url', { preHandler: tenant }, async (_req, reply) => {
    return reply.send(successEnvelope({ url: null as string | null, enabled: false }));
  });

  app.get('/vault/export.zip', { preHandler: tenant }, async () => {
    throw new AppError('NOT_IMPLEMENTED', 'Export ZIP ainda nao implementado; use git no servidor de vault.', 501);
  });

  app.get('/vault/tree', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const vaultRoot = deps.env.VAULT_ROOT?.trim() || path.join(process.cwd(), 'data', 'vaults');
    try {
      await deps.librarianPlatformAgent.ensureWorkspaceSecondBrain(ws);
    } catch {
      /* ignore */
    }
    const workspaceRoot = resolveVaultWorkspaceRoot(vaultRoot, ws);
    async function walkDir(abs: string, rel: string, depth: number): Promise<unknown[]> {
      if (depth > 8) return [];
      let entries: Dirent[];
      try {
        entries = (await fs.readdir(abs, { withFileTypes: true })) as Dirent[];
      } catch {
        return [];
      }
      const out: unknown[] = [];
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const nextAbs = path.join(abs, e.name);
        const nextRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          out.push({
            name: e.name,
            type: 'dir',
            path: nextRel,
            children: await walkDir(nextAbs, nextRel, depth + 1),
          });
        } else {
          out.push({ name: e.name, type: 'file', path: nextRel });
        }
      }
      return out;
    }
    const tree = await walkDir(workspaceRoot, '', 0);
    return reply.send(successEnvelope({ tree }));
  });
}
