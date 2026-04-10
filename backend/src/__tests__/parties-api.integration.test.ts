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
    const body = JSON.parse(res.body) as { data: { id: string; displayName: string; email?: string } };
    expect(body.data.displayName).toBe('Gamma Servicos SA');
    expect(body.data.email).toBe('contato@gamma.test');

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
    expect(body.data.phone).toBe('+5511888777666');

    const get = await app.inject({ method: 'GET', url: `/api/v1/parties/${id}`, headers });
    const one = JSON.parse(get.body) as { data: { displayName: string; phone?: string } };
    expect(one.data.displayName).toBe('Gamma Servicos SA (atualizado)');
    expect(one.data.phone).toBe('+5511888777666');
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
    const { data: created } = JSON.parse(create.body) as { data: { id: string; email?: string } };
    expect(created.email).toBe('delta@example.test');

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
});
