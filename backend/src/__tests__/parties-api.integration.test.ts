import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { PartyRepository } from '../modules/crm/infra/party.repository.js';

describe('parties API', () => {
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
    const ws = await WorkspaceModel.create({ name: 'PartyWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'party-api@test.com',
      passwordHash,
      name: 'Party User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    const parties = new PartyRepository();
    await parties.create(workspaceId, { displayName: 'Cliente Alpha Ltda' });
    await parties.create(workspaceId, { displayName: 'Beta Consultores' });

    app = await buildApp(env);
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
      payload: { email: 'party-api@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('lists recent parties without query', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ displayName: string }> };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.data.some((p) => p.displayName.includes('Alpha'))).toBe(true);
  });

  it('searches parties by q', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties?q=Beta',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ displayName: string; id: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0]?.displayName).toContain('Beta');
  });

  it('gets party by id', async () => {
    const headers = await authHeaders();
    const list = await app.inject({ method: 'GET', url: '/api/v1/parties?q=Alpha', headers });
    const { data } = JSON.parse(list.body) as { data: Array<{ id: string }> };
    const id = data[0]!.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/parties/${id}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const one = JSON.parse(res.body) as { data: { displayName: string } };
    expect(one.data.displayName).toContain('Alpha');
  });

  it('returns 404 for unknown party id', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties/507f1f77bcf86cd799439099',
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it('creates party via POST', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Gamma Servicos SA',
        email: 'contato@gamma.test',
        phone: '+5511999990000',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { data: { id: string; displayName: string; email?: string; phone?: string } };
    expect(body.data.displayName).toBe('Gamma Servicos SA');
    expect(body.data.email).toBe('contato@gamma.test');
    expect(body.data.phone).toBe('5511999990000');

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/parties/${body.data.id}`,
      headers,
    });
    expect(get.statusCode).toBe(200);
    const one = JSON.parse(get.body) as { data: { displayName: string } };
    expect(one.data.displayName).toBe('Gamma Servicos SA');
  });

  it('updates party via PUT', async () => {
    const headers = await authHeaders();
    const list = await app.inject({ method: 'GET', url: '/api/v1/parties?q=Gamma', headers });
    const { data } = JSON.parse(list.body) as { data: Array<{ id: string }> };
    const id = data[0]!.id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/parties/${id}`,
      headers,
      payload: { displayName: 'Gamma Servicos SA (atualizado)', phone: '+5511888777666' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { displayName: string; phone?: string } };
    expect(body.data.displayName).toBe('Gamma Servicos SA (atualizado)');
    expect(body.data.phone).toBe('5511888777666');

    const get = await app.inject({ method: 'GET', url: `/api/v1/parties/${id}`, headers });
    const one = JSON.parse(get.body) as { data: { displayName: string; phone?: string } };
    expect(one.data.displayName).toBe('Gamma Servicos SA (atualizado)');
    expect(one.data.phone).toBe('5511888777666');
  });

  it('lists parties by exact email filter', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties?email=contato@gamma.test',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ displayName: string; email?: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0]?.displayName).toContain('Gamma');
    expect(body.data[0]?.email).toBe('contato@gamma.test');
  });

  it('patches party status and filters by status', async () => {
    const headers = await authHeaders();
    const list = await app.inject({ method: 'GET', url: '/api/v1/parties?q=Gamma', headers });
    const { data } = JSON.parse(list.body) as { data: Array<{ id: string }> };
    const id = data[0]!.id;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/parties/${id}/status`,
      headers,
      payload: { status: 'inactive' },
    });
    expect(patch.statusCode).toBe(200);
    const patched = JSON.parse(patch.body) as { data: { status: string } };
    expect(patched.data.status).toBe('inactive');

    const inactiveList = await app.inject({
      method: 'GET',
      url: '/api/v1/parties?status=inactive',
      headers,
    });
    expect(inactiveList.statusCode).toBe(200);
    const inactiveBody = JSON.parse(inactiveList.body) as { data: Array<{ id: string; status: string }> };
    expect(inactiveBody.data.some((p) => p.id === id && p.status === 'inactive')).toBe(true);
  });

  it('executes CRM GOLD happy path (create -> lookup -> deactivate -> reactivate -> update)', async () => {
    const headers = await authHeaders();

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Omega Cliente Gold',
        email: 'omega@gold.test',
        phone: '+5511990011223',
        notes: 'caminho dourado',
      },
    });
    expect(create.statusCode).toBe(201);
    const created = JSON.parse(create.body) as { data: { id: string; status: string; email?: string; phone?: string } };
    expect(created.data.status).toBe('active');
    expect(created.data.email).toBe('omega@gold.test');
    expect(created.data.phone).toBe('5511990011223');

    const byEmail = await app.inject({
      method: 'GET',
      url: '/api/v1/parties?email=OMEGA@gold.test',
      headers,
    });
    expect(byEmail.statusCode).toBe(200);
    const byEmailBody = JSON.parse(byEmail.body) as { data: Array<{ id: string }> };
    expect(byEmailBody.data.some((p) => p.id === created.data.id)).toBe(true);

    const byPhone = await app.inject({
      method: 'GET',
      url: '/api/v1/parties?phone=5511990011223',
      headers,
    });
    expect(byPhone.statusCode).toBe(200);
    const byPhoneBody = JSON.parse(byPhone.body) as { data: Array<{ id: string }> };
    expect(byPhoneBody.data.some((p) => p.id === created.data.id)).toBe(true);

    const deactivate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/parties/${created.data.id}/status`,
      headers,
      payload: { status: 'inactive' },
    });
    expect(deactivate.statusCode).toBe(200);
    const deactivated = JSON.parse(deactivate.body) as { data: { status: string } };
    expect(deactivated.data.status).toBe('inactive');

    const reactivate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/parties/${created.data.id}/status`,
      headers,
      payload: { status: 'active' },
    });
    expect(reactivate.statusCode).toBe(200);
    const reactivated = JSON.parse(reactivate.body) as { data: { status: string } };
    expect(reactivated.data.status).toBe('active');

    const update = await app.inject({
      method: 'PUT',
      url: `/api/v1/parties/${created.data.id}`,
      headers,
      payload: { notes: 'caminho dourado atualizado' },
    });
    expect(update.statusCode).toBe(200);
    const updated = JSON.parse(update.body) as { data: { notes?: string } };
    expect(updated.data.notes).toContain('atualizado');
  });

  it('returns CRM readiness summary for troubleshooting', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties/readiness',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        total: number;
        active: number;
        inactive: number;
        withoutEmail: number;
        withoutPhone: number;
        updatedLast7d: number;
        health: 'ok' | 'attention' | 'critical';
        checks: Array<{
          code: string;
          status: 'ok' | 'attention' | 'critical';
          message: string;
          nextStep: string;
          value: number;
        }>;
        generatedAt: string;
      };
    };
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(body.data.active + body.data.inactive).toBe(body.data.total);
    expect(['ok', 'attention', 'critical']).toContain(body.data.health);
    expect(Array.isArray(body.data.checks)).toBe(true);
    expect(body.data.checks.length).toBeGreaterThan(0);
    expect(typeof body.data.generatedAt).toBe('string');
  });

  it('returns CRM gold gate evaluation with blocking criteria', async () => {
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/parties/gold-gate',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        approved: boolean;
        evaluatedAt: string;
        criteria: Array<{ code: string; passed: boolean; detail: string }>;
        blockingCriteria: Array<{ code: string; passed: boolean }>;
      };
    };
    expect(typeof body.data.approved).toBe('boolean');
    expect(typeof body.data.evaluatedAt).toBe('string');
    expect(Array.isArray(body.data.criteria)).toBe(true);
    expect(body.data.criteria.length).toBeGreaterThan(0);
    for (const c of body.data.blockingCriteria) {
      expect(c.passed).toBe(false);
    }
  });

  it('returns 400 when PUT body has no updatable fields', async () => {
    const headers = await authHeaders();
    const list = await app.inject({ method: 'GET', url: '/api/v1/parties?q=Alpha', headers });
    const { data } = JSON.parse(list.body) as { data: Array<{ id: string }> };
    const id = data[0]!.id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/parties/${id}`,
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('clears optional fields when PUT sends empty strings ($unset)', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Delta Com clear',
        email: 'delta@example.test',
        phone: '+5511999000111',
        notes: 'apagar isto',
      },
    });
    expect(create.statusCode).toBe(201);
    const { data: created } = JSON.parse(create.body) as { data: { id: string; email?: string; phone?: string } };
    expect(created.email).toBe('delta@example.test');
    expect(created.phone).toBe('5511999000111');

    const put = await app.inject({
      method: 'PUT',
      url: `/api/v1/parties/${created.id}`,
      headers,
      payload: {
        displayName: 'Delta Com clear',
        email: '',
        phone: '',
        notes: '',
      },
    });
    expect(put.statusCode).toBe(200);
    const updated = JSON.parse(put.body) as { data: { email?: string; phone?: string; notes?: string } };
    expect(updated.data.email).toBeUndefined();
    expect(updated.data.phone).toBeUndefined();
    expect(updated.data.notes).toBeUndefined();

    const get = await app.inject({ method: 'GET', url: `/api/v1/parties/${created.id}`, headers });
    expect(get.statusCode).toBe(200);
    const one = JSON.parse(get.body) as { data: { email?: string; phone?: string; notes?: string } };
    expect(one.data.email).toBeUndefined();
    expect(one.data.phone).toBeUndefined();
    expect(one.data.notes).toBeUndefined();
  });

  it('returns 409 CONFLICT when creating party with duplicate normalized phone', async () => {
    const headers = await authHeaders();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Cliente Celular A',
        phone: '+55 (79) 9 88228535',
      },
    });
    expect(first.statusCode).toBe(201);
    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Cliente Celular B',
        phone: '5579988228535',
      },
    });
    expect(dup.statusCode).toBe(409);
    const body = JSON.parse(dup.body) as {
      success: false;
      error: { code: string; details: { existingParty?: { displayName: string; phone?: string } } };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.details.existingParty?.phone).toBe('5579988228535');
    expect(body.error.details.existingParty?.displayName).toBe('Cliente Celular A');
  });

  it('deletes party by id when there are no operational references', async () => {
    const headers = await authHeaders();
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: { displayName: 'Para Excluir', phone: '+5511988877766' },
    });
    expect(create.statusCode).toBe(201);
    const { data: row } = JSON.parse(create.body) as { data: { id: string } };

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/parties/${row.id}`,
      headers,
    });
    expect(del.statusCode).toBe(200);
    const delBody = JSON.parse(del.body) as { data: { deleted: boolean; id: string } };
    expect(delBody.data.deleted).toBe(true);

    const get = await app.inject({ method: 'GET', url: `/api/v1/parties/${row.id}`, headers });
    expect(get.statusCode).toBe(404);
  });

  it('returns 409 when delete blocked by appointment', async () => {
    const headers = await authHeaders();
    const partyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/parties',
      headers,
      payload: {
        displayName: 'Cliente Com Agenda',
        phone: '+55 11 96665-5544',
      },
    });
    expect(partyRes.statusCode).toBe(201);
    const party = JSON.parse(partyRes.body) as { data: { id: string } };

    const availability = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/availability',
      headers,
      payload: {
        startsAt: '2027-05-10T09:00:00.000Z',
        endsAt: '2027-05-10T12:00:00.000Z',
        slotMinutes: 60,
        label: 'Manha CRM delete test',
      },
    });
    expect(availability.statusCode).toBe(201);

    const appt = await app.inject({
      method: 'POST',
      url: '/api/v1/schedule/appointments',
      headers,
      payload: {
        partyId: party.data.id,
        title: 'Consulta bloqueio delete',
        startsAt: '2027-05-10T10:00:00.000Z',
        endsAt: '2027-05-10T11:00:00.000Z',
        remindAt: '2027-05-10T08:00:00.000Z',
      },
    });
    expect(appt.statusCode).toBe(201);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/parties/${party.data.id}`,
      headers,
    });
    expect(del.statusCode).toBe(409);
    const err = JSON.parse(del.body) as {
      success: false;
      error: { code: string; details: { references?: Array<{ domain: string; count: number }> } };
    };
    expect(err.error.code).toBe('CONFLICT');
    expect(err.error.details.references?.some((r) => r.domain === 'appointments' && r.count >= 1)).toBe(true);
  });
});
