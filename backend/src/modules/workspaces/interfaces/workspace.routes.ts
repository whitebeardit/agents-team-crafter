import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const putWsSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']),
});

export async function registerWorkspaceRoutes(app: FastifyInstance, d: IAppDeps) {
  app.get('/workspaces', { preHandler: [d.authenticate] }, async (req, reply) => {
    const list = await d.workspaceRepo.listByUserId(req.user!.sub);
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

  app.get('/workspaces/:id', { preHandler: [d.authenticate] }, async (req, reply) => {
    const ws = await d.workspaceRepo.findByIdForUser((req.params as { id: string }).id, req.user!.sub);
    if (!ws) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
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
    { preHandler: [d.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const role = await d.memberRepo.findRole(req.user!.sub, id);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new AppError('FORBIDDEN', 'Sem permissao para atualizar workspace', 403);
      }
      const body = putWsSchema.parse(req.body);
      const ws = await d.workspaceRepo.updateWorkspace(id, body);
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

  app.get('/workspaces/:id/members', { preHandler: [d.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ok = await d.workspaceRepo.findByIdForUser(id, req.user!.sub);
    if (!ok) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
    const members = await d.memberRepo.listMembers(id);
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
    { preHandler: [d.authenticate] },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const role = await d.memberRepo.findRole(req.user!.sub, id);
      if (!role || !['owner', 'admin'].includes(role)) {
        throw new AppError('FORBIDDEN', 'Sem permissao para convidar', 403);
      }
      const body = inviteSchema.parse(req.body);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const inv = await d.inviteRepo.create({
        workspaceId: id,
        email: body.email,
        role: body.role,
        expiresAt: expires,
      });
      return reply.code(201).send(successEnvelope(inv));
    },
  );
}
