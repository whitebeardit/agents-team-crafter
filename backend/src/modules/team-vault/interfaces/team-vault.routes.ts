import type { FastifyInstance } from 'fastify';
import type { Dirent } from 'node:fs';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { resolveVaultWorkspaceRoot } from '../application/vault-path-guard.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const listQuerySchema = z.object({
  status: z.enum(['proposed', 'active', 'archived', 'rejected']).optional(),
  agentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function registerTeamVaultRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.get('/vault/notes', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const q = listQuerySchema.parse(req.query);
    const rows = await deps.vaultNoteIndexRepo.listByFilter(
      ws,
      {
        ...(q.status ? { status: q.status } : {}),
        ...(q.agentId ? { agentId: q.agentId } : {}),
      },
      q.limit ?? 50,
    );
    return reply.send(successEnvelope(rows));
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
    const r = await deps.vaultWriter.setNoteStatus({
      workspaceId: ws,
      noteId,
      status: 'active',
      userId: req.user?.sub,
    });
    await deps.vaultIndexer.reindexWorkspace(ws);
    return reply.send(successEnvelope(r));
  });

  app.put('/vault/notes/:noteId/reject', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const noteId = (req.params as { noteId: string }).noteId;
    const r = await deps.vaultWriter.setNoteStatus({
      workspaceId: ws,
      noteId,
      status: 'rejected',
      userId: req.user?.sub,
    });
    await deps.vaultIndexer.reindexWorkspace(ws);
    return reply.send(successEnvelope(r));
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
