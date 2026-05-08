import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { requireAdmin } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';

const listQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  q: z.string().optional(),
  paid: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const partyReceivablesQuerySchema = z.object({
  paid: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const financeReceivedSummaryQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const markReceivablePaidBodySchema = z.object({
  paymentNote: z.string().optional(),
});

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const s = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const e = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

export async function registerFinanceRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenant = [deps.authenticate, deps.requireTenant];
  const financeRepo = deps.financeRepo;
  if (!financeRepo) {
    throw new AppError('INTERNAL_ERROR', 'FinanceRepository não configurado no container.', 500);
  }

  app.get('/finance/receivables', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const query = listQuerySchema.parse(req.query);
    if (query.startDate > query.endDate) {
      throw new AppError('VALIDATION_ERROR', 'A data inicial deve ser menor ou igual à data final.', 400);
    }
    const days = daysBetweenInclusive(query.startDate, query.endDate);
    if (days > 90) {
      throw new AppError('VALIDATION_ERROR', 'Intervalo máximo permitido: 90 dias.', 400);
    }
    const rows = await financeRepo.listReceivablesByDateRange(ws, {
      startDate: query.startDate,
      endDate: query.endDate,
      paid: query.paid,
      limit: query.limit ?? 300,
    });
    const partyIds = [...new Set(rows.map((row) => row.partyId))];
    const partiesMap = new Map<string, { id: string; displayName: string; email?: string; phone?: string }>();
    await Promise.all(
      partyIds.map(async (partyId) => {
        const party = await deps.partyRepo.findById(ws, partyId);
        if (!party) return;
        partiesMap.set(partyId, {
          id: party.id,
          displayName: party.displayName,
          email: party.email,
          phone: party.phone,
        });
      }),
    );
    const enriched = rows.map((row) => ({ ...row, party: partiesMap.get(row.partyId) ?? null }));
    const q = query.q?.trim().toLowerCase();
    const filtered = q
      ? enriched.filter((row) =>
          [
            row.id,
            row.partyId,
            row.description ?? '',
            row.party?.displayName ?? '',
            row.party?.email ?? '',
            row.party?.phone ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : enriched;
    return reply.send(
      successEnvelope({
        receivables: filtered,
        range: { startDate: query.startDate, endDate: query.endDate, days },
        total: filtered.length,
      }),
    );
  });

  app.get('/finance/payables', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const query = listQuerySchema.parse(req.query);
    if (query.startDate > query.endDate) {
      throw new AppError('VALIDATION_ERROR', 'A data inicial deve ser menor ou igual à data final.', 400);
    }
    const days = daysBetweenInclusive(query.startDate, query.endDate);
    if (days > 90) {
      throw new AppError('VALIDATION_ERROR', 'Intervalo máximo permitido: 90 dias.', 400);
    }
    const rows = await financeRepo.listPayablesByDateRange(ws, {
      startDate: query.startDate,
      endDate: query.endDate,
      paid: query.paid,
      limit: query.limit ?? 300,
    });
    const partyIds = [...new Set(rows.map((row) => row.destinationPartyId))];
    const partiesMap = new Map<string, { id: string; displayName: string; email?: string; phone?: string }>();
    await Promise.all(
      partyIds.map(async (partyId) => {
        const party = await deps.partyRepo.findById(ws, partyId);
        if (!party) return;
        partiesMap.set(partyId, {
          id: party.id,
          displayName: party.displayName,
          email: party.email,
          phone: party.phone,
        });
      }),
    );
    const enriched = rows.map((row) => ({ ...row, party: partiesMap.get(row.destinationPartyId) ?? null }));
    const q = query.q?.trim().toLowerCase();
    const filtered = q
      ? enriched.filter((row) =>
          [
            row.id,
            row.destinationPartyId,
            row.description ?? '',
            row.party?.displayName ?? '',
            row.party?.email ?? '',
            row.party?.phone ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : enriched;
    return reply.send(
      successEnvelope({
        payables: filtered,
        range: { startDate: query.startDate, endDate: query.endDate, days },
        total: filtered.length,
      }),
    );
  });

  app.get('/finance/parties/:partyId/receivables/summary', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const partyId = z.object({ partyId: z.string().min(1) }).parse(req.params).partyId;
    const totals = await financeRepo.partyReceivableTotals(ws, partyId);
    const party = await deps.partyRepo.findById(ws, partyId);
    return reply.send(
      successEnvelope({
        partyId,
        party: party
          ? { id: party.id, displayName: party.displayName, email: party.email, phone: party.phone }
          : null,
        totals,
      }),
    );
  });

  app.get('/finance/parties/:partyId/receivables', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const partyId = z.object({ partyId: z.string().min(1) }).parse(req.params).partyId;
    const query = partyReceivablesQuerySchema.parse(req.query);
    const rows = await financeRepo.listReceivablesByParty(ws, partyId, {
      paid: query.paid,
      limit: query.limit ?? 200,
    });
    const party = await deps.partyRepo.findById(ws, partyId);
    return reply.send(
      successEnvelope({
        partyId,
        party: party
          ? { id: party.id, displayName: party.displayName, email: party.email, phone: party.phone }
          : null,
        receivables: rows,
        total: rows.length,
      }),
    );
  });

  app.get('/finance/received-summary', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const query = financeReceivedSummaryQuerySchema.parse(req.query);
    if (query.startDate > query.endDate) {
      throw new AppError('VALIDATION_ERROR', 'A data inicial deve ser menor ou igual à data final.', 400);
    }
    const days = daysBetweenInclusive(query.startDate, query.endDate);
    if (days > 90) {
      throw new AppError('VALIDATION_ERROR', 'Intervalo máximo permitido: 90 dias.', 400);
    }
    const agg = await financeRepo.sumReceivablesReceivedInPeriod(ws, query.startDate, query.endDate);
    return reply.send(successEnvelope({ ...agg, range: { startDate: query.startDate, endDate: query.endDate, days } }));
  });

  app.post('/finance/receivables/:id/mark-paid', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const body = markReceivablePaidBodySchema.parse(req.body ?? {});
    const row = await financeRepo.markReceivablePaid(ws, id, {
      paymentNote: body.paymentNote,
    });
    if (!row) throw new AppError('NOT_FOUND', 'Recebível não encontrado', 404);
    return reply.send(successEnvelope(row));
  });

  app.delete('/finance/receivables/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const blockers = await financeRepo.getReceivableDeleteBlockers(ws, id);
    if (blockers.length > 0) {
      throw new AppError(
        'CONFLICT',
        'Recebível não pode ser removido porque está em uso por outros registros.',
        409,
        { references: blockers },
      );
    }
    const ok = await financeRepo.deleteReceivableById(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Recebível não encontrado', 404);
    return reply.send(successEnvelope({ deleted: true, id }));
  });

  app.delete('/finance/payables/:id', { preHandler: [...tenant, requireAdmin()] }, async (req, reply) => {
    const ws = req.workspaceId!;
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const blockers = await financeRepo.getPayableDeleteBlockers(ws, id);
    if (blockers.length > 0) {
      throw new AppError(
        'CONFLICT',
        'Pagável não pode ser removido porque está em uso por outros registros.',
        409,
        { references: blockers },
      );
    }
    const ok = await financeRepo.deletePayableById(ws, id);
    if (!ok) throw new AppError('NOT_FOUND', 'Pagável não encontrado', 404);
    return reply.send(successEnvelope({ deleted: true, id }));
  });
}
