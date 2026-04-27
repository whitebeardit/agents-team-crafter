import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { resolvePartyIdFromPartyOrPhone } from '../../crm/application/resolve-party-id-from-input.js';
import type { AppointmentRepository } from '../infra/appointment.repository.js';
import type { AvailabilitySlotRepository } from '../infra/availability-slot.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import type { ServiceOrderRepository } from '../../services-sales/infra/service-order.repository.js';
import type { PackageSaleRepository } from '../../packages-encounters/infra/package-sale.repository.js';
import type { ReminderRepository } from '../../reminders/infra/reminder.repository.js';
import type { EncounterRepository } from '../../packages-encounters/infra/encounter.repository.js';

function parseIso(input: unknown, field: string): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error(`${field} (ISO) obrigatorio`);
  const v = new Date(input);
  if (Number.isNaN(v.getTime())) throw new Error(`${field} (ISO) invalido`);
  return v.toISOString();
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function registerSchedulingPack(
  registry: BusinessToolRegistry,
  appointments: AppointmentRepository,
  availabilitySlots: AvailabilitySlotRepository,
  parties: PartyRepository,
  careSubjects: CareSubjectRepository,
  serviceOrders: ServiceOrderRepository,
  packageSales: PackageSaleRepository,
  reminders: ReminderRepository,
  encounters: EncounterRepository,
): void {
  registry.register('schedule_set_availability', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const startsAt = parseIso(data.startsAt, 'startsAt');
    const endsAt = parseIso(data.endsAt, 'endsAt');
    const slotMinutes = Number(data.slotMinutes);
    if (Number.isNaN(slotMinutes) || slotMinutes < 5) throw new Error('slotMinutes deve ser >= 5');
    if (new Date(startsAt) >= new Date(endsAt)) throw new Error('startsAt deve ser menor que endsAt');
    return availabilitySlots.create(workspaceId, {
      startsAt,
      endsAt,
      slotMinutes,
      label: typeof data.label === 'string' ? data.label : undefined,
    });
  });

  registry.register('schedule_create_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
    const title = typeof data.title === 'string' ? data.title : '';
    if (!title.trim()) throw new Error('title obrigatorio');
    const startsAt = parseIso(data.startsAt, 'startsAt');
    const endsAt = parseIso(data.endsAt, 'endsAt');
    if (new Date(startsAt) >= new Date(endsAt)) throw new Error('startsAt deve ser menor que endsAt');

    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : undefined;
    if (careSubjectId) {
      const subject = await careSubjects.findById(workspaceId, careSubjectId);
      if (!subject) throw new Error('careSubject nao encontrado');
      if (subject.partyId !== partyId) throw new Error('careSubject deve pertencer ao mesmo partyId');
    }

    const serviceOrderId = typeof data.serviceOrderId === 'string' ? data.serviceOrderId : undefined;
    if (serviceOrderId) {
      const order = await serviceOrders.findById(workspaceId, serviceOrderId);
      if (!order) throw new Error('serviceOrder nao encontrado');
      if (order.partyId !== partyId) throw new Error('serviceOrder deve pertencer ao mesmo partyId');
    }

    let packageSaleId =
      typeof data.packageSaleId === 'string' && data.packageSaleId.trim()
        ? data.packageSaleId.trim()
        : undefined;

    /** Quando só há uma venda elegível para a party, amarra ao agendamento sem exigir packageSaleId ao utilizador. */
    if (!packageSaleId) {
      const partySales = await packageSales.listByParty(workspaceId, partyId);
      const eligibleSales = partySales.filter((s) => s.remaining >= 1);
      if (eligibleSales.length === 1) {
        packageSaleId = eligibleSales[0]?.id;
      }
    }

    if (packageSaleId) {
      const sale = await packageSales.findById(workspaceId, packageSaleId);
      if (!sale) throw new Error('packageSale nao encontrado');
      if (sale.partyId !== partyId) throw new Error('packageSale deve pertencer ao mesmo partyId');
      if (sale.remaining < 1) throw new Error('packageSale sem saldo elegivel para agendamento');
    }

    const encounterId = typeof data.encounterId === 'string' ? data.encounterId : undefined;
    if (encounterId) {
      const encounter = await encounters.findById(workspaceId, encounterId);
      if (!encounter) throw new Error('encounter nao encontrado');
      if (encounter.partyId !== partyId) throw new Error('encounter deve pertencer ao mesmo partyId');
    }

    let reminderId: string | undefined;
    const remindAt = typeof data.remindAt === 'string' ? data.remindAt : undefined;
    if (remindAt) {
      const reminder = await reminders.create(workspaceId, {
        title: `Lembrete: ${title.trim()}`,
        at: parseIso(remindAt, 'remindAt'),
      });
      reminderId = reminder.id;
    }

    return appointments.create(workspaceId, {
      partyId,
      title,
      startsAt,
      endsAt,
      careSubjectId,
      serviceOrderId,
      packageSaleId,
      encounterId,
      reminderId,
      notes: typeof data.notes === 'string' ? data.notes : '',
    });
  });

  registry.register('schedule_reschedule_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const current = await appointments.findById(workspaceId, appointmentId);
    if (!current) throw new Error('appointment nao encontrado');
    const startsAt = parseIso(data.startsAt, 'startsAt');
    const endsAt = parseIso(data.endsAt, 'endsAt');
    if (new Date(startsAt) >= new Date(endsAt)) throw new Error('startsAt deve ser menor que endsAt');

    let reminderId = current.reminderId;
    if (current.reminderId) await reminders.cancel(workspaceId, current.reminderId);
    const remindAt = typeof data.remindAt === 'string' ? data.remindAt : undefined;
    if (remindAt) {
      const reminder = await reminders.create(workspaceId, {
        title: `Lembrete reagendado: ${current.title}`,
        at: parseIso(remindAt, 'remindAt'),
      });
      reminderId = reminder.id;
    } else {
      reminderId = undefined;
    }

    const next = await appointments.reschedule(workspaceId, appointmentId, {
      startsAt,
      endsAt,
      reminderId,
      notes: typeof data.notes === 'string' ? data.notes : current.notes,
    });
    if (!next) throw new Error('appointment nao encontrado');
    return next;
  });

  registry.register('schedule_cancel_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const current = await appointments.findById(workspaceId, appointmentId);
    if (!current) throw new Error('appointment nao encontrado');
    if (current.reminderId) await reminders.cancel(workspaceId, current.reminderId);
    const next = await appointments.updateStatus(workspaceId, appointmentId, 'cancelled');
    if (!next) throw new Error('appointment nao encontrado');
    return next;
  });

  registry.register('schedule_delete_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const current = await appointments.findById(workspaceId, appointmentId);
    if (!current) throw new Error('appointment nao encontrado');
    if (current.status !== 'cancelled' && current.status !== 'no_show') {
      throw new Error(
        'Apenas compromissos cancelados ou marcados como falta podem ser removidos definitivamente',
      );
    }
    if (current.reminderId) await reminders.cancel(workspaceId, current.reminderId);
    const ok = await appointments.hardDelete(workspaceId, appointmentId);
    if (!ok) throw new Error('appointment nao encontrado');
    return { deleted: true, id: appointmentId };
  });

  registry.register('schedule_confirm_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const next = await appointments.updateStatus(workspaceId, appointmentId, 'confirmed');
    if (!next) throw new Error('appointment nao encontrado');
    return next;
  });

  registry.register('schedule_mark_no_show', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const next = await appointments.updateStatus(workspaceId, appointmentId, 'no_show');
    if (!next) throw new Error('appointment nao encontrado');
    return next;
  });

  registry.register('schedule_complete_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const current = await appointments.findById(workspaceId, appointmentId);
    if (!current) throw new Error('appointment nao encontrado');
    if (current.status === 'cancelled') throw new Error('appointment cancelado nao pode ser concluido');
    if (current.status === 'no_show') throw new Error('appointment marcado como no_show nao pode ser concluido');

    const encounter =
      current.encounterId
        ? await encounters.findById(workspaceId, current.encounterId)
        : await encounters.create(workspaceId, {
            partyId: current.partyId,
            packageSaleId: current.packageSaleId,
            careSubjectId: current.careSubjectId,
            notes: typeof data.notes === 'string' ? data.notes : current.notes,
            durationMinutes:
              typeof data.durationMinutes === 'number' ? data.durationMinutes : Number(data.durationMinutes) || 0,
          });
    if (!encounter) throw new Error('nao foi possivel concluir appointment');

    if (current.reminderId) {
      await reminders.markDone(workspaceId, current.reminderId);
    }

    const next = await appointments.complete(workspaceId, appointmentId, {
      encounterId: encounter.id,
      notes: typeof data.notes === 'string' ? data.notes : current.notes,
    });
    if (!next) throw new Error('appointment nao encontrado');
    return { ...next, encounterId: encounter.id };
  });

  registry.register('schedule_list_agenda_by_date', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const date = typeof data.date === 'string' ? data.date : '';
    if (!date) throw new Error('date (ISO dia) obrigatorio');
    return { appointments: await appointments.listByDate(workspaceId, date) };
  });

  registry.register('schedule_get_availability', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const date = typeof data.date === 'string' ? data.date : '';
    if (!date) throw new Error('date (ISO dia) obrigatorio');
    const includeCancelled =
      data.includeCancelled === false || data.includeCancelled === 'false' ? false : true;
    const slots = await availabilitySlots.listByDate(workspaceId, date);
    const rawAgenda = await appointments.listByDate(workspaceId, date);
    const agenda = includeCancelled
      ? rawAgenda
      : rawAgenda.filter((a) => a.status !== 'cancelled');
    const blocking = rawAgenda.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');

    const availability = slots.flatMap((slot) => {
      const out: Array<{ startsAt: string; endsAt: string; available: boolean; slotId: string }> = [];
      const slotStart = new Date(slot.startsAt);
      const slotEnd = new Date(slot.endsAt);
      for (
        let cursor = slotStart.getTime();
        cursor + slot.slotMinutes * 60000 <= slotEnd.getTime();
        cursor += slot.slotMinutes * 60000
      ) {
        const startsAt = new Date(cursor);
        const endsAt = new Date(cursor + slot.slotMinutes * 60000);
        const busy = blocking.some((a) =>
          rangesOverlap(startsAt, endsAt, new Date(a.startsAt), new Date(a.endsAt)),
        );
        out.push({
          slotId: slot.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          available: !busy,
        });
      }
      return out;
    });

    return { availability, slots, appointments: agenda };
  });

  registry.register('clinic_schedule_session', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    if (!careSubjectId) throw new Error('careSubjectId obrigatorio para agendamento clinico');
    const subject = await careSubjects.findById(workspaceId, careSubjectId);
    if (!subject) throw new Error('careSubject nao encontrado');
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio para agendamento clinico');
    if (subject.partyId !== partyId) throw new Error('careSubject deve pertencer ao mesmo partyId no contexto clinico');
    const handler = registry.get('schedule_create_appointment');
    if (!handler) throw new Error('schedule_create_appointment indisponivel');
    return handler({ workspaceId, input: data, correlationId });
  });

  registry.register('clinic_reschedule_session', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const existing = await appointments.findById(workspaceId, appointmentId);
    if (!existing) throw new Error('appointment nao encontrado');
    if (!existing.careSubjectId) throw new Error('appointment sem contexto clinico (careSubjectId)');
    const handler = registry.get('schedule_reschedule_appointment');
    if (!handler) throw new Error('schedule_reschedule_appointment indisponivel');
    return handler({ workspaceId, input: data, correlationId });
  });

  registry.register('clinic_cancel_session', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const existing = await appointments.findById(workspaceId, appointmentId);
    if (!existing) throw new Error('appointment nao encontrado');
    if (!existing.careSubjectId) throw new Error('appointment sem contexto clinico (careSubjectId)');
    const handler = registry.get('schedule_cancel_appointment');
    if (!handler) throw new Error('schedule_cancel_appointment indisponivel');
    return handler({ workspaceId, input: data, correlationId });
  });
}
