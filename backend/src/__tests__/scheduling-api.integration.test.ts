import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { PartyRepository } from '../modules/crm/infra/party.repository.js';

describe('scheduling API', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const workspace = await WorkspaceModel.create({ name: 'ScheduleWs', plan: 'free' });
    workspaceId = workspace._id.toString();
    const user = await UserModel.create({
      email: 'schedule@test.com',
      passwordHash,
      name: 'Schedule User',
      workspaceIds: [workspace._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: 'owner',
    });

    app = await buildApp(env);
  });

  afterEach(async () => {
    await mongoose.connection.db?.collection('appointments').deleteMany({});
    await mongoose.connection.db?.collection('availabilityslots').deleteMany({});
    await mongoose.connection.db?.collection('reminders').deleteMany({});
    await mongoose.connection.db?.collection('encounters').deleteMany({});
    await mongoose.connection.db?.collection('parties').deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'schedule@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('creates appointments and exposes agenda availability', async () => {
    const headers = await authHeaders();
    const parties = new PartyRepository();
    const party = await parties.create(workspaceId, { displayName: 'Cliente Agenda API' });

    const availability = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/availability',
      headers,
      payload: {
        startsAt: '2026-04-14T09:00:00.000Z',
        endsAt: '2026-04-14T12:00:00.000Z',
        slotMinutes: 60,
        label: 'Manha',
      },
    });
    expect(availability.statusCode).toBe(201);

    const appointmentCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.id,
        title: 'Consulta inicial',
        startsAt: '2026-04-14T10:00:00.000Z',
        endsAt: '2026-04-14T11:00:00.000Z',
        remindAt: '2026-04-14T08:00:00.000Z',
      },
    });
    expect(appointmentCreate.statusCode).toBe(201);

    const agenda = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/agenda?date=2026-04-14',
      headers,
    });
    expect(agenda.statusCode).toBe(200);
    const agendaData = JSON.parse(agenda.body) as {
      data: {
        slots: unknown[];
        appointments: Array<{ title: string }>;
        availability: Array<{ startsAt: string; available: boolean }>;
      };
    };

    expect(agendaData.data.slots).toHaveLength(1);
    expect(agendaData.data.appointments).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Consulta inicial' })]),
    );
    expect(agendaData.data.availability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startsAt: '2026-04-14T09:00:00.000Z', available: true }),
        expect.objectContaining({ startsAt: '2026-04-14T10:00:00.000Z', available: false }),
        expect.objectContaining({ startsAt: '2026-04-14T11:00:00.000Z', available: true }),
      ]),
    );
  });

  it('returns scheduling gold gate evaluation', async () => {
    const headers = await authHeaders();
    const parties = new PartyRepository();
    const party = await parties.create(workspaceId, { displayName: 'Cliente Gate Scheduling' });

    await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/availability',
      headers,
      payload: {
        startsAt: '2026-04-22T09:00:00.000Z',
        endsAt: '2026-04-22T12:00:00.000Z',
        slotMinutes: 60,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.id,
        title: 'Consulta gate',
        startsAt: '2026-04-22T10:00:00.000Z',
        endsAt: '2026-04-22T11:00:00.000Z',
      },
    });

    const gate = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/gold-gate?date=2026-04-22',
      headers,
    });
    expect(gate.statusCode).toBe(200);
    const body = JSON.parse(gate.body) as {
      data: {
        approved: boolean;
        criteria: Array<{ code: string; passed: boolean; detail: string }>;
        blockingCriteria: Array<{ code: string; passed: boolean }>;
        snapshot: { date: string; appointments: number; activeAppointments: number; slots: number; freeWindows: number };
      };
    };
    expect(typeof body.data.approved).toBe('boolean');
    expect(body.data.criteria.length).toBeGreaterThanOrEqual(3);
    expect(body.data.snapshot.date).toBe('2026-04-22');
    for (const c of body.data.blockingCriteria) {
      expect(c.passed).toBe(false);
    }
  });

  it('completes an appointment through the API', async () => {
    const headers = await authHeaders();
    const parties = new PartyRepository();
    const party = await parties.create(workspaceId, { displayName: 'Cliente Complete API' });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.id,
        title: 'Retorno concluido',
        startsAt: '2026-04-15T10:00:00.000Z',
        endsAt: '2026-04-15T11:00:00.000Z',
        remindAt: '2026-04-15T09:00:00.000Z',
      },
    });
    expect(create.statusCode).toBe(201);
    const created = JSON.parse(create.body) as { data: { id: string } };

    const complete = await app.inject({
      method: 'POST',
      url: `/api/v1/schedule/appointments/${created.data.id}/complete`,
      headers,
      payload: {
        notes: 'Atendimento realizado',
        durationMinutes: 60,
      },
    });
    expect(complete.statusCode).toBe(200);
    const completed = JSON.parse(complete.body) as {
      data: { status: string; encounterId?: string; notes: string };
    };
    expect(completed.data.status).toBe('completed');
    expect(completed.data.encounterId).toBeTruthy();
    expect(completed.data.notes).toBe('Atendimento realizado');

    const appointments = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/appointments?date=2026-04-15',
      headers,
    });
    expect(appointments.statusCode).toBe(200);
    const list = JSON.parse(appointments.body) as {
      data: { appointments: Array<{ id: string; status: string; encounterId?: string }> };
    };
    expect(list.data.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.data.id,
          status: 'completed',
          encounterId: completed.data.encounterId,
        }),
      ]),
    );
  });

  it('hides cancelled appointments from agenda when includeCancelled=false', async () => {
    const headers = await authHeaders();
    const parties = new PartyRepository();
    const party = await parties.create(workspaceId, { displayName: 'Cliente Cancel Filter' });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.id,
        title: 'Será cancelado',
        startsAt: '2026-04-20T14:00:00.000Z',
        endsAt: '2026-04-20T15:00:00.000Z',
      },
    });
    expect(create.statusCode).toBe(201);
    const apptId = (JSON.parse(create.body) as { data: { id: string } }).data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/schedule/appointments/${apptId}/cancel`,
      headers,
    });

    const withCancelled = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/agenda?date=2026-04-20&includeCancelled=true',
      headers,
    });
    const withBody = JSON.parse(withCancelled.body) as {
      data: { appointments: Array<{ id: string; status: string }> };
    };
    expect(withBody.data.appointments.some((a) => a.id === apptId && a.status === 'cancelled')).toBe(true);

    const withoutCancelled = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/agenda?date=2026-04-20&includeCancelled=false',
      headers,
    });
    const woBody = JSON.parse(withoutCancelled.body) as {
      data: { appointments: Array<{ id: string }> };
    };
    expect(woBody.data.appointments.some((a) => a.id === apptId)).toBe(false);
  });

  it('DELETE appointment removes cancelled row (admin)', async () => {
    const headers = await authHeaders();
    const parties = new PartyRepository();
    const party = await parties.create(workspaceId, { displayName: 'Cliente Delete' });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.id,
        title: 'Remover',
        startsAt: '2026-04-21T16:00:00.000Z',
        endsAt: '2026-04-21T17:00:00.000Z',
      },
    });
    const apptId = (JSON.parse(create.body) as { data: { id: string } }).data.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/schedule/appointments/${apptId}/cancel`,
      headers,
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/schedule/appointments/${apptId}`,
      headers,
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/appointments?date=2026-04-21',
      headers,
    });
    const listBody = JSON.parse(list.body) as {
      data: { appointments: Array<{ id: string }> };
    };
    expect(listBody.data.appointments.some((a) => a.id === apptId)).toBe(false);
  });
});
