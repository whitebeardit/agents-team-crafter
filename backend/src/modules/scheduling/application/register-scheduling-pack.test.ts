import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerSchedulingPack } from './register-scheduling-pack.js';
import { AppointmentRepository } from '../infra/appointment.repository.js';
import { AvailabilitySlotRepository } from '../infra/availability-slot.repository.js';
import { PartyRepository } from '../../crm/infra/party.repository.js';
import { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import { ServiceCatalogRepository } from '../../services-sales/infra/service-catalog.repository.js';
import { ServiceOrderRepository } from '../../services-sales/infra/service-order.repository.js';
import { PackageSaleRepository } from '../../packages-encounters/infra/package-sale.repository.js';
import { ReminderRepository } from '../../reminders/infra/reminder.repository.js';
import { EncounterRepository } from '../../packages-encounters/infra/encounter.repository.js';

describe('registerSchedulingPack', () => {
  let mongo: MongoMemoryServer;
  const workspaceId = '507f1f77bcf86cd799439011';

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  it('creates appointments and computes availability from slots', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const catalog = new ServiceCatalogRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Cliente Agenda' });
    const subject = await careSubjects.create(workspaceId, {
      partyId: party.id,
      name: 'Paciente Agenda',
      subjectKind: 'human',
    });
    const item = await catalog.create(workspaceId, { name: 'Sessao', unitPrice: 100 });
    const order = await serviceOrders.create(workspaceId, party.id, [
      { catalogItemId: item.id, quantity: 1, unitPrice: 100 },
    ]);
    const sale = await packageSales.create(workspaceId, {
      partyId: party.id,
      packageName: 'Pacote 4 sessoes',
      unitsTotal: 4,
    });

    await registry.get('schedule_set_availability')!({
      workspaceId,
      input: {
        startsAt: '2026-04-11T09:00:00.000Z',
        endsAt: '2026-04-11T12:00:00.000Z',
        slotMinutes: 60,
        label: 'Manha',
      },
    });

    const appointment = (await registry.get('schedule_create_appointment')!({
      workspaceId,
      input: {
        partyId: party.id,
        careSubjectId: subject.id,
        serviceOrderId: order.id,
        packageSaleId: sale.id,
        title: 'Sessao inicial',
        startsAt: '2026-04-11T10:00:00.000Z',
        endsAt: '2026-04-11T11:00:00.000Z',
        remindAt: '2026-04-11T08:00:00.000Z',
      },
    })) as { title: string; reminderId?: string };

    expect(appointment.title).toBe('Sessao inicial');
    expect(appointment.reminderId).toBeTruthy();

    const avail = (await registry.get('schedule_get_availability')!({
      workspaceId,
      input: { date: '2026-04-11' },
    })) as {
      slots: unknown[];
      appointments: unknown[];
      availability: Array<{ startsAt: string; available: boolean }>;
    };

    expect(avail.slots).toHaveLength(1);
    expect(avail.appointments).toHaveLength(1);
    expect(avail.availability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startsAt: '2026-04-11T09:00:00.000Z', available: true }),
        expect.objectContaining({ startsAt: '2026-04-11T10:00:00.000Z', available: false }),
        expect.objectContaining({ startsAt: '2026-04-11T11:00:00.000Z', available: true }),
      ]),
    );
  });

  it('binds sole eligible package sale when packageSaleId omitted', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Cliente AutoPacote' });
    const sale = await packageSales.create(workspaceId, {
      partyId: party.id,
      packageName: 'Pacote único',
      unitsTotal: 4,
    });

    const apt = (await registry.get('schedule_create_appointment')!({
      workspaceId,
      input: {
        partyId: party.id,
        title: 'Consulta só party',
        startsAt: '2026-06-02T17:00:00.000Z',
        endsAt: '2026-06-02T17:50:00.000Z',
      },
    })) as { packageSaleId?: string };

    expect(apt.packageSaleId).toBe(sale.id);
  });

  it('reschedules and cancels appointment reminders', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Cliente Reagenda' });
    const created = (await registry.get('schedule_create_appointment')!({
      workspaceId,
      input: {
        partyId: party.id,
        title: 'Retorno',
        startsAt: '2026-04-12T13:00:00.000Z',
        endsAt: '2026-04-12T14:00:00.000Z',
        remindAt: '2026-04-12T12:00:00.000Z',
      },
    })) as { id: string; reminderId?: string };

    const rescheduled = (await registry.get('schedule_reschedule_appointment')!({
      workspaceId,
      input: {
        appointmentId: created.id,
        startsAt: '2026-04-12T15:00:00.000Z',
        endsAt: '2026-04-12T16:00:00.000Z',
        remindAt: '2026-04-12T14:00:00.000Z',
      },
    })) as { startsAt: string; reminderId?: string };
    expect(rescheduled.startsAt).toBe('2026-04-12T15:00:00.000Z');
    expect(rescheduled.reminderId).not.toBe(created.reminderId);

    const cancelled = (await registry.get('schedule_cancel_appointment')!({
      workspaceId,
      input: { appointmentId: created.id },
    })) as { status: string };
    expect(cancelled.status).toBe('cancelled');

    const visibleReminders = await reminders.listByDate(workspaceId, '2026-04-12');
    expect(visibleReminders).toHaveLength(0);
  });

  it('completes appointment by creating encounter and marking reminder done', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Cliente Conclusao' });
    const subject = await careSubjects.create(workspaceId, {
      partyId: party.id,
      name: 'Paciente Conclusao',
      subjectKind: 'human',
    });
    const sale = await packageSales.create(workspaceId, {
      partyId: party.id,
      packageName: 'Pacote Fechamento',
      unitsTotal: 2,
    });

    const created = (await registry.get('schedule_create_appointment')!({
      workspaceId,
      input: {
        partyId: party.id,
        careSubjectId: subject.id,
        packageSaleId: sale.id,
        title: 'Sessao concluida',
        startsAt: '2026-04-13T09:00:00.000Z',
        endsAt: '2026-04-13T10:00:00.000Z',
        remindAt: '2026-04-13T08:00:00.000Z',
      },
    })) as { id: string; reminderId?: string };

    const completed = (await registry.get('schedule_complete_appointment')!({
      workspaceId,
      input: {
        appointmentId: created.id,
        notes: 'Atendimento realizado',
        durationMinutes: 60,
      },
    })) as { status: string; encounterId?: string };

    expect(completed.status).toBe('completed');
    expect(completed.encounterId).toBeTruthy();

    const encounter = await encounters.findById(workspaceId, completed.encounterId!);
    expect(encounter?.partyId).toBe(party.id);
    expect(encounter?.careSubjectId).toBe(subject.id);
    expect(encounter?.packageSaleId).toBe(sale.id);

    const visibleReminders = await reminders.listByDate(workspaceId, '2026-04-13');
    expect(visibleReminders).toHaveLength(1);
    expect(visibleReminders[0]?.done).toBe(true);
  });

  it('schedule_delete_appointment hard-deletes cancelled appointments', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Hard delete' });
    const created = (await registry.get('schedule_create_appointment')!({
      workspaceId,
      input: {
        partyId: party.id,
        title: 'Tmp',
        startsAt: '2026-05-01T10:00:00.000Z',
        endsAt: '2026-05-01T11:00:00.000Z',
      },
    })) as { id: string };

    await registry.get('schedule_cancel_appointment')!({
      workspaceId,
      input: { appointmentId: created.id },
    });

    const del = (await registry.get('schedule_delete_appointment')!({
      workspaceId,
      input: { appointmentId: created.id },
    })) as { deleted: boolean };
    expect(del.deleted).toBe(true);
    expect(await appointments.findById(workspaceId, created.id)).toBeNull();
  });

  it('clinic composite actions enforce clinical context before delegating to scheduling primitive', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const party = await parties.create(workspaceId, { displayName: 'Cliente Clinico' });

    await expect(
      registry.get('clinic_schedule_session')!({
        workspaceId,
        input: {
          partyId: party.id,
          title: 'Sessao sem sujeito',
          startsAt: '2026-06-01T09:00:00.000Z',
          endsAt: '2026-06-01T10:00:00.000Z',
        },
      }),
    ).rejects.toThrow('careSubjectId obrigatorio');

    const subject = await careSubjects.create(workspaceId, {
      partyId: party.id,
      name: 'Paciente Clinico',
      subjectKind: 'psych',
    });

    const created = (await registry.get('clinic_schedule_session')!({
      workspaceId,
      input: {
        partyId: party.id,
        careSubjectId: subject.id,
        title: 'Sessao clinica',
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:00:00.000Z',
      },
    })) as { id: string; careSubjectId?: string };
    expect(created.careSubjectId).toBe(subject.id);

    const rescheduled = (await registry.get('clinic_reschedule_session')!({
      workspaceId,
      input: {
        appointmentId: created.id,
        startsAt: '2026-06-01T10:00:00.000Z',
        endsAt: '2026-06-01T11:00:00.000Z',
      },
    })) as { startsAt: string };
    expect(rescheduled.startsAt).toBe('2026-06-01T10:00:00.000Z');

    const cancelled = (await registry.get('clinic_cancel_session')!({
      workspaceId,
      input: { appointmentId: created.id },
    })) as { status: string };
    expect(cancelled.status).toBe('cancelled');
  });

  it('blocks appointment creation when package does not belong to party or has no remaining units', async () => {
    const registry = new BusinessToolRegistry();
    const appointments = new AppointmentRepository();
    const availability = new AvailabilitySlotRepository();
    const parties = new PartyRepository();
    const careSubjects = new CareSubjectRepository();
    const serviceOrders = new ServiceOrderRepository();
    const packageSales = new PackageSaleRepository();
    const reminders = new ReminderRepository();
    const encounters = new EncounterRepository();

    registerSchedulingPack(
      registry,
      appointments,
      availability,
      parties,
      careSubjects,
      serviceOrders,
      packageSales,
      reminders,
      encounters,
    );

    const partyA = await parties.create(workspaceId, { displayName: 'Party A' });
    const partyB = await parties.create(workspaceId, { displayName: 'Party B' });
    const packageFromA = await packageSales.create(workspaceId, {
      partyId: partyA.id,
      packageName: 'Pacote A',
      unitsTotal: 1,
    });

    await expect(
      registry.get('schedule_create_appointment')!({
        workspaceId,
        input: {
          partyId: partyB.id,
          packageSaleId: packageFromA.id,
          title: 'Sessao indevida',
          startsAt: '2026-06-02T09:00:00.000Z',
          endsAt: '2026-06-02T10:00:00.000Z',
        },
      }),
    ).rejects.toThrow('packageSale deve pertencer ao mesmo partyId');

    await packageSales.consumeUnit(workspaceId, packageFromA.id);
    await expect(
      registry.get('schedule_create_appointment')!({
        workspaceId,
        input: {
          partyId: partyA.id,
          packageSaleId: packageFromA.id,
          title: 'Sessao sem saldo',
          startsAt: '2026-06-02T11:00:00.000Z',
          endsAt: '2026-06-02T12:00:00.000Z',
        },
      }),
    ).rejects.toThrow('packageSale sem saldo elegivel para agendamento');
  });
});
