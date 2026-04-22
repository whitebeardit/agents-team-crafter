import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { getPartyDeleteBlockers } from '../application/party-delete-blockers.js';
import type { IPartyUpdateOperation } from '../infra/party.repository.js';

const listQuerySchema = z.object({
  q: z.string().optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(40).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const createPartyBodySchema = z.object({
  displayName: z.string().min(1).max(200),
  roles: z.array(z.string().min(1)).max(20).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

const updatePartyBodySchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
    roles: z.array(z.string().min(1)).max(20).optional(),
    email: z.string().max(320).optional(),
    phone: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export async function registerPartyRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];

  app.post('/parties', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const body = createPartyBodySchema.parse(req.body);
    const email = body.email?.trim();
    const data = await deps.partyRepo.create(ws, {
      displayName: body.displayName.trim(),
      roles: body.roles,
      ...(email ? { email } : {}),
      ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
      ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
    });
    return reply.code(201).send(successEnvelope(data));
  });

  app.get('/parties', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const query = listQuerySchema.parse(req.query);
    const limit = query.limit ?? 30;
    const q = query.q?.trim() ?? '';
    const email = query.email?.trim() ?? '';
    const phone = query.phone?.trim() ?? '';
    const rows = email || phone
      ? await deps.partyRepo.findByEmailOrPhone(ws, { email, phone, limit })
      : q
        ? await deps.partyRepo.findByQuery(ws, q, limit)
        : query.status
          ? await deps.partyRepo.listParties(ws, { status: query.status, limit })
          : await deps.partyRepo.listRecent(ws, limit);
    return reply.send(successEnvelope(rows));
  });

  app.get('/parties/readiness', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const summary = await deps.partyRepo.readinessSummary(ws);
    req.log.info(
      {
        event: 'crm.readiness_snapshot',
        workspaceId: ws,
        health: summary.health,
        total: summary.total,
        inactive: summary.inactive,
        withoutEmail: summary.withoutEmail,
        withoutPhone: summary.withoutPhone,
      },
      'crm readiness snapshot generated',
    );
    return reply.send(successEnvelope(summary));
  });

  app.get('/parties/gold-gate', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const gate = await deps.partyRepo.goldGateSummary(ws);
    req.log.info(
      {
        event: 'crm.gold_gate_evaluated',
        workspaceId: ws,
        approved: gate.approved,
        blockingCriteria: gate.blockingCriteria.map((c) => c.code),
      },
      'crm gold gate evaluated',
    );
    return reply.send(successEnvelope(gate));
  });

  app.patch('/parties/:id/status', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const body = z
      .object({
        status: z.enum(['active', 'inactive']),
      })
      .parse(req.body);
    const row = await deps.partyRepo.update(ws, id, {
      set: { status: body.status },
      unset: [],
    });
    if (!row) throw new AppError('NOT_FOUND', 'Contato nao encontrado', 404);
    return reply.send(successEnvelope(row));
  });

  app.get('/parties/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const row = await deps.partyRepo.findById(ws, id);
    if (!row) throw new AppError('NOT_FOUND', 'Contato nao encontrado', 404);
    return reply.send(successEnvelope(row));
  });

  app.put('/parties/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const body = updatePartyBodySchema.parse(req.body);
    const set: IPartyUpdateOperation['set'] = {};
    const unset: IPartyUpdateOperation['unset'] = [];
    if (body.displayName !== undefined) set.displayName = body.displayName.trim();
    if (body.roles !== undefined) set.roles = body.roles;
    if (body.email !== undefined) {
      const t = body.email.trim();
      if (t) set.email = t;
      else unset.push('email');
    }
    if (body.phone !== undefined) {
      const t = body.phone.trim();
      if (t) set.phone = t;
      else unset.push('phone');
    }
    if (body.notes !== undefined) {
      const t = body.notes.trim();
      if (t) set.notes = t;
      else unset.push('notes');
    }
    if (Object.keys(set).length === 0 && unset.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Envie pelo menos um campo para atualizar', 400);
    }
    const row = await deps.partyRepo.update(ws, id, { set, unset });
    if (!row) throw new AppError('NOT_FOUND', 'Contato nao encontrado', 404);
    return reply.send(successEnvelope(row));
  });

  app.delete('/parties/:id', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const blockers = await getPartyDeleteBlockers(ws, id);
    if (blockers.length > 0) {
      throw new AppError(
        'CONFLICT',
        'Contato nao pode ser removido porque existem registos operacionais vinculados. Resolva as referencias ou arquive antes de excluir.',
        409,
        { references: blockers },
      );
    }
    const ok = await deps.partyRepo.deleteById(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Contato nao encontrado', 404);
    return reply.send(successEnvelope({ deleted: true, id }));
  });
}
