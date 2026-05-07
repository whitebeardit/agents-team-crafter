import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import type { IWorkspaceRecord } from '../domain/ports/workspace-repository.port.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { deleteWorkspaceCascade } from '../application/delete-workspace-cascade.service.js';

const putWsSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  logo: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']),
});

const patchMemberSchema = z.object({
  role: z.literal('admin'),
});

async function getWorkspaceIfAllowed(
  deps: IAppDeps,
  user: { sub: string; isPlatformAdmin?: boolean },
  workspaceId: string,
): Promise<IWorkspaceRecord> {
  if (user.isPlatformAdmin) {
    const ws = await deps.workspaceRepo.findById(workspaceId);
    if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    return ws;
  }
  const ws = await deps.workspaceRepo.findByIdForUser(workspaceId, user.sub);
  if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
  return ws;
}

async function assertCanInviteToWorkspace(
  deps: IAppDeps,
  userId: string,
  isPlatformAdmin: boolean | undefined,
  workspaceId: string,
): Promise<void> {
  if (isPlatformAdmin) {
    const ws = await deps.workspaceRepo.findById(workspaceId);
    if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    return;
  }
  const role = await deps.memberRepo.findRole(userId, workspaceId);
  if (!role || !['owner', 'admin'].includes(role)) {
    throw new AppError('FORBIDDEN', 'Sem permissao para convidar', 403);
  }
}

async function assertCanDeleteWorkspace(
  deps: IAppDeps,
  user: { sub: string; isPlatformAdmin?: boolean },
  workspaceId: string,
): Promise<void> {
  if (user.isPlatformAdmin) {
    const ws = await deps.workspaceRepo.findById(workspaceId);
    if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    return;
  }
  const role = await deps.memberRepo.findRole(user.sub, workspaceId);
  if (!role || !['owner', 'admin'].includes(role)) {
    throw new AppError('FORBIDDEN', 'Sem permissao para excluir workspace', 403);
  }
}

export async function registerWorkspaceRoutes(app: FastifyInstance, deps: IAppDeps) {
  app.get('/workspaces', { preHandler: [deps.authenticate] }, async (req, reply) => {
    const list = req.user!.isPlatformAdmin
      ? await deps.workspaceRepo.listAll()
      : await deps.workspaceRepo.listByUserId(req.user!.sub);
    return reply.send(
      successEnvelope(
        list.map((w) => ({
          id: w.id,
          name: w.name,
          logo: w.logo,
          plan: w.plan,
        })),
      ),
    );
  });

  app.post(
    '/workspaces',
    { preHandler: [deps.authenticate, deps.requirePlatformAdmin] },
    async (req, reply) => {
      const body = createWorkspaceSchema.parse(req.body);
      const ws = await deps.workspaceRepo.createWorkspace({
        name: body.name,
        logo: body.logo,
        plan: body.plan,
      });
      await deps.memberRepo.addMember(ws.id, req.user!.sub, 'owner');
      await deps.userRepo.addWorkspaceId(req.user!.sub, ws.id);
      try {
        await deps.librarianPlatformAgent.ensureWorkspaceSecondBrain(ws.id);
      } catch {
        /* vault/librarian bootstrap best-effort */
      }
      return reply.code(201).send(
        successEnvelope({
          id: ws.id,
          name: ws.name,
          logo: ws.logo,
          plan: ws.plan,
          settings: ws.settings,
        }),
      );
    },
  );

  app.post(
    '/workspaces/invites/:inviteId/accept',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const inviteId = (req.params as { inviteId: string }).inviteId;
      const inv = await deps.inviteRepo.findValidById(inviteId);
      if (!inv) throw new AppError('NOT_FOUND', 'Convite nao encontrado', 404);
      if (inv.consumedAt) {
        throw new AppError('VALIDATION_ERROR', 'Convite ja utilizado', 400);
      }
      if (inv.revokedAt) {
        throw new AppError('VALIDATION_ERROR', 'Convite revogado', 400);
      }
      if (inv.expiresAt.getTime() < Date.now()) {
        throw new AppError('VALIDATION_ERROR', 'Convite expirado', 400);
      }
      const user = await deps.userRepo.findById(req.user!.sub);
      if (!user) throw new AppError('UNAUTHORIZED', 'Usuario nao encontrado', 401);
      if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
        throw new AppError('FORBIDDEN', 'Este convite nao e para o seu email', 403);
      }
      const existing = await deps.memberRepo.findRole(user.id, inv.workspaceId);
      if (existing) {
        await deps.inviteRepo.markConsumed(inviteId);
        return reply.send(successEnvelope({ ok: true, workspaceId: inv.workspaceId, alreadyMember: true }));
      }
      await deps.memberRepo.addMember(
        inv.workspaceId,
        user.id,
        inv.role === 'admin' ? 'admin' : 'member',
      );
      await deps.userRepo.addWorkspaceId(user.id, inv.workspaceId);
      await deps.inviteRepo.markConsumed(inviteId);
      return reply.send(
        successEnvelope({
          ok: true,
          workspaceId: inv.workspaceId,
          role: inv.role,
          alreadyMember: false,
        }),
      );
    },
  );

  app.get('/workspaces/:id', { preHandler: [deps.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ws = await getWorkspaceIfAllowed(deps, req.user!, id);
    return reply.send(
      successEnvelope({
        id: ws.id,
        name: ws.name,
        logo: ws.logo,
        plan: ws.plan,
        createdAt: ws.createdAt.toISOString(),
        settings: ws.settings,
      }),
    );
  });

  app.put(
    '/workspaces/:id',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const role = await deps.memberRepo.findRole(req.user!.sub, id);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new AppError('FORBIDDEN', 'Sem permissao para atualizar workspace', 403);
      }
      const body = putWsSchema.parse(req.body);
      const ws = await deps.workspaceRepo.updateWorkspace(id, body);
      if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
      return reply.send(
        successEnvelope({
          id: ws.id,
          name: ws.name,
          logo: ws.logo,
          plan: ws.plan,
          settings: ws.settings,
        }),
      );
    },
  );

  app.delete(
    '/workspaces/:id',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      await assertCanDeleteWorkspace(deps, req.user!, id);
      await deleteWorkspaceCascade(deps, id);
      return reply.send(successEnvelope({ ok: true }));
    },
  );

  app.get('/workspaces/:id/members', { preHandler: [deps.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await getWorkspaceIfAllowed(deps, req.user!, id);
    const members = await deps.memberRepo.listMembers(id);
    return reply.send(
      successEnvelope(
        members.map((m) => ({
          id: m.userId,
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      ),
    );
  });

  app.post(
    '/workspaces/:id/members/invite',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      await assertCanInviteToWorkspace(deps, req.user!.sub, req.user!.isPlatformAdmin, id);
      const body = inviteSchema.parse(req.body);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const inv = await deps.inviteRepo.create({
        workspaceId: id,
        email: body.email,
        role: body.role,
        expiresAt: expires,
      });
      return reply.code(201).send(successEnvelope(inv));
    },
  );

  app.get(
    '/workspaces/:id/invites',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      await getWorkspaceIfAllowed(deps, req.user!, id);
      await assertCanInviteToWorkspace(deps, req.user!.sub, req.user!.isPlatformAdmin, id);
      const list = await deps.inviteRepo.listByWorkspace(id);
      return reply.send(successEnvelope(list));
    },
  );

  app.post(
    '/workspaces/:id/invites/:inviteId/revoke',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const inviteId = (req.params as { inviteId: string }).inviteId;
      await getWorkspaceIfAllowed(deps, req.user!, id);
      await assertCanInviteToWorkspace(deps, req.user!.sub, req.user!.isPlatformAdmin, id);
      const existing = await deps.inviteRepo.findOneInWorkspace(inviteId, id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Convite nao encontrado', 404);
      }
      if (existing.consumedAt) {
        throw new AppError('VALIDATION_ERROR', 'Convite ja utilizado', 400);
      }
      if (existing.revokedAt) {
        throw new AppError('VALIDATION_ERROR', 'Convite ja revogado', 400);
      }
      const ok = await deps.inviteRepo.revoke(inviteId, id);
      if (!ok) {
        throw new AppError('VALIDATION_ERROR', 'Nao foi possivel revogar o convite', 400);
      }
      return reply.send(successEnvelope({ ok: true }));
    },
  );

  app.delete(
    '/workspaces/:id/invites/:inviteId',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const inviteId = (req.params as { inviteId: string }).inviteId;
      await getWorkspaceIfAllowed(deps, req.user!, id);
      await assertCanInviteToWorkspace(deps, req.user!.sub, req.user!.isPlatformAdmin, id);
      const ok = await deps.inviteRepo.deletePermanently(inviteId, id);
      if (!ok) {
        throw new AppError('NOT_FOUND', 'Convite nao encontrado', 404);
      }
      return reply.send(successEnvelope({ ok: true }));
    },
  );

  app.patch(
    '/workspaces/:id/members/:userId',
    { preHandler: [deps.authenticate] },
    async (req, reply) => {
      const workspaceId = (req.params as { id: string }).id;
      const targetUserId = (req.params as { userId: string }).userId;
      patchMemberSchema.parse(req.body);
      const actorRole = await deps.memberRepo.findRole(req.user!.sub, workspaceId);
      if (!actorRole || !['owner', 'admin'].includes(actorRole)) {
        throw new AppError('FORBIDDEN', 'Sem permissao', 403);
      }
      const targetRole = await deps.memberRepo.findRole(targetUserId, workspaceId);
      if (!targetRole || targetRole !== 'member') {
        throw new AppError('VALIDATION_ERROR', 'So e possivel promover membros a admin', 400);
      }
      await deps.memberRepo.updateMemberRole(workspaceId, targetUserId, 'admin');
      return reply.send(successEnvelope({ ok: true }));
    },
  );
}
