import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { requireAdmin } from '../../../config/container.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';

const dateQuerySchema = z.object({
  date: z.string().min(1),
});

const agendaQuerySchema = z.object({
  date: z.string().min(1),
  /** Quando `false`, omite compromissos cancelados da lista (cancelamento e soft-delete). */
  includeCancelled: z.enum(['true', 'false']).optional(),
});

const scheduleGoldGateQuerySchema = z.object({
  date: z.string().min(1),
});

const availabilityBodySchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  slotMinutes: z.coerce.number().int().min(5),
  label: z.string().optional(),
});

const createAppointmentBodySchema = z.object({
  partyId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  careSubjectId: z.string().min(1).optional(),
  serviceOrderId: z.string().min(1).optional(),
  packageSaleId: z.string().min(1).optional(),
  encounterId: z.string().min(1).optional(),
  remindAt: z.string().min(1).optional(),
  notes: z.string().optional(),
  expectedAmount: z.coerce.number().positive().optional(),
  createSessionReceivable: z.boolean().optional(),
});

const rescheduleAppointmentBodySchema = z.object({
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  remindAt: z.string().min(1).optional(),
  notes: z.string().optional(),
});

const completeAppointmentBodySchema = z.object({
  notes: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(0).optional(),
  paymentReceived: z.boolean().optional(),
  receivableId: z.string().min(1).optional(),
  paymentNote: z.string().optional(),
});

function mapBusinessActionError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const httpStatus = message.includes('nao encontrado') ? 404 : 400;
  throw new AppError('VALIDATION_ERROR', message, httpStatus);
}

async function executeBusinessAction(
  deps: IAppDeps,
  workspaceId: string,
  actionId: string,
  input: Record<string, unknown>,
  correlationId?: string,
) {
  const handler = deps.businessToolRegistry.get(actionId);
  if (!handler) {
    throw new AppError('INTERNAL_ERROR', `Acao interna indisponivel: ${actionId}`, 500);
  }
  try {
    return await handler({ workspaceId, input, correlationId });
  } catch (error) {
    mapBusinessActionError(error);
  }
}

export async function registerSchedulingRoutes(app: FastifyInstance, deps: IAppDeps) {
  const auth = [deps.authenticate, deps.requireTenant];

  app.get('/schedule/gold-gate', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const query = scheduleGoldGateQuerySchema.parse(req.query);
    const raw = (await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_get_availability',
      { date: query.date, includeCancelled: true },
      req.requestId,
    )) as {
      appointments?: Array<{ status?: string }>;
      availability?: Array<{ available?: boolean }>;
      slots?: unknown[];
    };

    const appointments = Array.isArray(raw.appointments) ? raw.appointments : [];
    const availability = Array.isArray(raw.availability) ? raw.availability : [];
    const slots = Array.isArray(raw.slots) ? raw.slots : [];
    const activeAppointments = appointments.filter((a) => a.status !== 'cancelled');

    const criteria = [
      {
        code: 'schedule_has_slots',
        label: 'Disponibilidade publicada',
        passed: slots.length > 0,
        detail: slots.length > 0 ? 'Há slots cadastrados para o dia.' : 'Ainda não existem slots cadastrados para o dia.',
      },
      {
        code: 'schedule_has_active_appointments',
        label: 'Compromissos operáveis',
        passed: activeAppointments.length > 0,
        detail:
          activeAppointments.length > 0
            ? 'Há compromissos não-cancelados na agenda.'
            : 'Não há compromissos operáveis no dia.',
      },
      {
        code: 'schedule_has_free_windows',
        label: 'Janelas livres',
        passed: availability.some((a) => Boolean(a.available)),
        detail: availability.some((a) => Boolean(a.available))
          ? 'Existe pelo menos uma janela livre.'
          : 'Não há janelas livres no recorte consultado.',
      },
    ];

    const blockingCriteria = criteria.filter((c) => !c.passed);
    const approved = blockingCriteria.length === 0;
    const evaluatedAt = new Date().toISOString();
    req.log.info(
      {
        event: 'schedule.gold_gate_evaluated',
        workspaceId,
        date: query.date,
        approved,
        blockingCriteria: blockingCriteria.map((c) => c.code),
      },
      'schedule gold gate evaluated',
    );

    return reply.send(
      successEnvelope({
        approved,
        evaluatedAt,
        criteria,
        blockingCriteria,
        snapshot: {
          date: query.date,
          appointments: appointments.length,
          activeAppointments: activeAppointments.length,
          slots: slots.length,
          freeWindows: availability.filter((a) => Boolean(a.available)).length,
        },
      }),
    );
  });

  app.get('/schedule/agenda', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const query = agendaQuerySchema.parse(req.query);
    const includeCancelled = query.includeCancelled !== 'false';
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_get_availability',
      { date: query.date, includeCancelled },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.get('/schedule/appointments', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const query = dateQuerySchema.parse(req.query);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_list_agenda_by_date',
      { date: query.date },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.post('/schedule/availability', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const body = availabilityBodySchema.parse(req.body);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_set_availability',
      body,
      req.requestId,
    );
    return reply.code(201).send(successEnvelope(data));
  });

  app.post('/schedule/appointments', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const body = createAppointmentBodySchema.parse(req.body);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_create_appointment',
      body,
      req.requestId,
    );
    return reply.code(201).send(successEnvelope(data));
  });

  app.post('/schedule/appointments/:id/reschedule', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = rescheduleAppointmentBodySchema.parse(req.body);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_reschedule_appointment',
      { appointmentId: params.id, ...body },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.post('/schedule/appointments/:id/confirm', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_confirm_appointment',
      { appointmentId: params.id },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.post('/schedule/appointments/:id/cancel', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_cancel_appointment',
      { appointmentId: params.id },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.delete('/schedule/appointments/:id', { preHandler: [...auth, requireAdmin()] }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_delete_appointment',
      { appointmentId: params.id },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.post('/schedule/appointments/:id/no-show', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_mark_no_show',
      { appointmentId: params.id },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });

  app.post('/schedule/appointments/:id/complete', { preHandler: auth }, async (req, reply) => {
    const workspaceId = req.workspaceId!;
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = completeAppointmentBodySchema.parse(req.body ?? {});
    const data = await executeBusinessAction(
      deps,
      workspaceId,
      'schedule_complete_appointment',
      { appointmentId: params.id, ...body },
      req.requestId,
    );
    return reply.send(successEnvelope(data));
  });
}
