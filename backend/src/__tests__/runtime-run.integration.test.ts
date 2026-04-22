import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';
import { PartyModel } from '../modules/crm/infra/party.model.js';

describe('POST /teams/:id/run (team runtime)', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let teamId = '';
  let coordId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: undefined,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'W', plan: 'free' });
    const u = await UserModel.create({
      email: 'u@test.com',
      passwordHash,
      name: 'User',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: u._id,
      role: 'owner',
    });

    const agentB = await AgentModel.create({
      workspaceId: ws._id,
      name: 'B',
      description: 'specialist',
      role: 'specialist',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente B',
      capabilities: {},
    });
    const agentA = await AgentModel.create({
      workspaceId: ws._id,
      name: 'A',
      description: '',
      role: 'coordinator',
      origin: 'company',
      version: '1.0.0',
      category: 'geral',
      channels: [],
      status: 'active',
      systemInstruction: 'Agente coordenador',
      capabilities: {},
    });
    coordId = agentA._id.toString();

    const team = await TeamModel.create({
      workspaceId: ws._id,
      name: 'T1',
      description: '',
      status: 'active',
      coordinatorId: agentA._id,
      agentIds: [agentB._id],
      channelIds: [],
    });
    teamId = team._id.toString();

    env.OPENAI_API_KEY = undefined;
    process.env.OPENAI_API_KEY = '';

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function loginAndGetToken() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return data.token;
  }

  it('executes team with coordinator as sole top-level agent (no handoff chain in API)', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: { message: 'validar nota', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data.coordinatorAgentId).toBe(coordId);
    expect(body.data.teamId).toBe(teamId);
    const er = body.data.externalResponse as {
      text?: string;
      format?: string;
      attachments?: unknown;
    };
    expect(er.text).toBeDefined();
    expect(er.attachments === undefined || Array.isArray(er.attachments)).toBe(true);
    expect(body.data).not.toHaveProperty('handoffs');
    expect(body.data).not.toHaveProperty('selectedAgentId');
    expect(Array.isArray(body.data.specialistResults)).toBe(true);
  });

  it('routes "listar todos os clientes cadastrados" directly to CRM read without coordinator loop', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const workspaceId = String((ws as { _id: unknown })._id);

    await PartyModel.create({
      workspaceId,
      displayName: 'Cliente Lista Direta',
      roles: ['customer'],
      status: 'active',
      email: 'lista@empresa.test',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
      payload: { message: 'liste todos os clientes cadastrados', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events?: Array<{ type?: string; detail?: string }>; externalResponse?: { text?: string } };
    };
    expect(body.data.events?.some((e) => e.type === 'crmDirectReadRoute')).toBe(true);
    expect(body.data.events?.some((e) => e.type === 'coordinatorStarted')).toBe(false);
    expect(body.data.externalResponse?.text).toContain('Encontrei');
    expect(body.data.externalResponse?.text).toContain('Cliente Lista Direta');
  });

  it('routes find by email directly to CRM identifier read', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const workspaceId = String((ws as { _id: unknown })._id);

    await PartyModel.create({
      workspaceId,
      displayName: 'Cliente Email Direto',
      roles: ['customer'],
      status: 'active',
      email: 'email-direto@empresa.test',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
      payload: { message: 'buscar cliente pelo e-mail email-direto@empresa.test', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events?: Array<{ type?: string; detail?: string }>; externalResponse?: { text?: string } };
    };
    expect(body.data.events?.some((e) => e.type === 'crmDirectReadRoute')).toBe(true);
    expect(body.data.events?.some((e) => e.type === 'coordinatorStarted')).toBe(false);
    expect(body.data.externalResponse?.text).toContain('Cliente Email Direto');
    expect(body.data.externalResponse?.text).toContain('email-direto@empresa.test');
  });

  it('routes find by phone directly to CRM identifier read', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const workspaceId = String((ws as { _id: unknown })._id);

    await PartyModel.create({
      workspaceId,
      displayName: 'Cliente Telefone Direto',
      roles: ['customer'],
      status: 'active',
      phone: '5511999998888',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
      payload: { message: 'encontre o cliente com telefone +5511999998888', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events?: Array<{ type?: string; detail?: string }>; externalResponse?: { text?: string } };
    };
    expect(body.data.events?.some((e) => e.type === 'crmDirectReadRoute')).toBe(true);
    expect(body.data.events?.some((e) => e.type === 'coordinatorStarted')).toBe(false);
    expect(body.data.externalResponse?.text).toContain('Cliente Telefone Direto');
    expect(body.data.externalResponse?.text).toMatch(/5511999998888/);
  });

  it('returns early on structured stop command with stop_reason and resume hint', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const workspaceId = String((ws as { _id: unknown })._id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
      payload: { message: '/stop motivo: revisar briefing', taskType: 'invoice_validation' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: {
        externalResponse: { text?: string };
        runId: string;
        specialistResults?: unknown[];
        events?: Array<{
          type?: string;
          stopReason?: string;
          resumeHint?: string;
          interrupted?: boolean;
          interruptReasonCode?: string;
          interruptReasonMessage?: string;
          nextStep?: string;
        }>;
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.externalResponse.text).toMatch(/Execução interrompida/i);
    expect(body.data.externalResponse.text).toMatch(/Próximo passo sugerido/i);
    expect(body.data.externalResponse.text).toMatch(/stop_reason/i);
    expect(body.data.specialistResults).toEqual([]);
    const cancelled = body.data.events?.find((e) => e.type === 'runCancelled');
    const interrupted = body.data.events?.find((e) => e.type === 'executionInterrupted');
    expect(cancelled).toBeDefined();
    expect(cancelled?.stopReason).toMatch(/motivo: revisar briefing/i);
    expect(cancelled?.resumeHint).toMatch(/retomar/i);
    expect(cancelled?.interrupted).toBe(true);
    expect(cancelled?.interruptReasonCode).toBe('USER_CANCELLED');
    expect(cancelled?.interruptReasonMessage).toMatch(/pedido explícito do utilizador/i);
    expect(cancelled?.nextStep).toMatch(/continuar/i);
    expect(interrupted).toBeDefined();
    expect(interrupted?.interruptReasonCode).toBe('USER_CANCELLED');
    expect(interrupted?.interrupted).toBe(true);

    const runRes = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${body.data.runId}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
    });
    expect(runRes.statusCode).toBe(200);
    const runBody = JSON.parse(runRes.body) as {
      data: {
        status?: string;
        interrupt?: {
          interrupted?: boolean;
          interruptReasonCode?: string;
          interruptReasonMessage?: string;
          interruptReasonDetail?: string;
          interruptStep?: string;
          interruptPolicy?: string;
          nextStep?: string;
        };
      };
    };
    expect(runBody.data.status).toBe('cancelled');
    expect(runBody.data.interrupt?.interrupted).toBe(true);
    expect(runBody.data.interrupt?.interruptReasonCode).toBe('USER_CANCELLED');
    expect(runBody.data.interrupt?.interruptReasonMessage).toMatch(/pedido explícito do utilizador/i);
    expect(runBody.data.interrupt?.interruptReasonDetail).toMatch(/Cancelamento solicitado pelo utilizador/i);
    expect(runBody.data.interrupt?.interruptStep).toBe('preflight');
    expect(runBody.data.interrupt?.interruptPolicy).toBe('USER_COMMAND');
    expect(runBody.data.interrupt?.nextStep).toMatch(/continuar/i);

    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${body.data.runId}/events`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
    });
    expect(eventsRes.statusCode).toBe(200);
    const eventsBody = JSON.parse(eventsRes.body) as {
      data: Array<{ type?: string; payload?: { interruptReasonCode?: string; interrupted?: boolean } }>;
    };
    const cancelledEvent = eventsBody.data.find((e) => e.type === 'runCancelled');
    const interruptedEvent = eventsBody.data.find((e) => e.type === 'executionInterrupted');
    expect(cancelledEvent?.payload?.interruptReasonCode).toBe('USER_CANCELLED');
    expect(cancelledEvent?.payload?.interrupted).toBe(true);
    expect(interruptedEvent?.payload?.interruptReasonCode).toBe('USER_CANCELLED');
  });

  it('requires single explicit confirmation for destructive requests in same conversation', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-destrutivo-1';

    const ask = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'apagar o cliente 123',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(ask.statusCode).toBe(200);
    const askBody = JSON.parse(ask.body) as {
      data: { events?: Array<{ type?: string }>; specialistResults?: unknown[]; externalResponse?: { text?: string } };
    };
    expect(askBody.data.events?.some((e) => e.type === 'destructiveConfirmationRequested')).toBe(true);
    expect(askBody.data.events?.some((e) => e.type === 'destructiveAuditSnapshot')).toBe(true);
    expect(askBody.data.specialistResults).toEqual([]);
    expect(askBody.data.externalResponse?.text).toMatch(/confirmo/i);

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'confirmo',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(confirm.statusCode).toBe(200);
    const confirmBody = JSON.parse(confirm.body) as { data: { events?: Array<{ type?: string }> } };
    expect(confirmBody.data.events?.some((e) => e.type === 'destructiveConfirmationRequested')).toBe(
      false,
    );
    expect(confirmBody.data.events?.some((e) => e.type === 'destructiveAuditSnapshot')).toBe(true);
  });

  it('expires pending destructive confirmation by time window and asks to resend intent', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-destrutivo-expira-1';
    const baseNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNow);

    const ask = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'apagar o cliente 999',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(ask.statusCode).toBe(200);

    nowSpy.mockReturnValue(baseNow + 11 * 60 * 1000);
    const confirmLate = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'confirmo apagar o cliente 999',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    nowSpy.mockRestore();

    expect(confirmLate.statusCode).toBe(200);
    const body = JSON.parse(confirmLate.body) as {
      data: { events?: Array<{ type?: string }>; externalResponse?: { text?: string } };
    };
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationRequested')).toBe(true);
    expect(body.data.externalResponse?.text).toMatch(/pedido destrutivo identificado/i);
  });

  it('does not return destructiveConfirmationExpired for plain "confirmo" without pending destructive state', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-nao-destrutivo-confirmo-1';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'confirmo',
        taskType: 'invoice_validation',
        conversationId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events?: Array<{ type?: string }>; externalResponse?: { text?: string } };
    };
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationExpired') ?? false).toBe(false);
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationRequested') ?? false).toBe(false);
    expect(body.data.externalResponse?.text).toMatch(/chave openai nao configurada/i);
  });

  it('keeps patient onboarding conversation outside destructive guard when user replies "confirmo"', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-paciente-multiturno-1';

    const turn1 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'Quero cadastrar uma nova paciente de psicologia.',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(turn1.statusCode).toBe(200);

    const turn2 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'Nome: Maria Clara, email: maria@teste.com, telefone: +351900000000.',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(turn2.statusCode).toBe(200);

    const turn3 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'confirmo',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(turn3.statusCode).toBe(200);
    const body = JSON.parse(turn3.body) as { data: { events?: Array<{ type?: string }> } };
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationExpired') ?? false).toBe(false);
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationRequested') ?? false).toBe(false);
  });

  it('rejects destructive confirmation when target differs from pending request', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-destrutivo-mismatch-1';

    const ask = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'apagar o cliente 123',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(ask.statusCode).toBe(200);

    const mismatch = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'confirmo apagar cliente 999',
        taskType: 'invoice_validation',
        conversationId,
      },
    });

    expect(mismatch.statusCode).toBe(200);
    const body = JSON.parse(mismatch.body) as {
      data: {
        events?: Array<{ type?: string }>;
        specialistResults?: unknown[];
        externalResponse?: { text?: string };
      };
    };
    expect(body.data.events?.some((e) => e.type === 'destructiveConfirmationTargetMismatch')).toBe(true);
    expect(body.data.specialistResults).toEqual([]);
    expect(body.data.externalResponse?.text).toMatch(/alvo diferente/i);
  });

  it('persists destructive audit entries to external store when configured', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const tempDir = await mkdtemp(join(tmpdir(), 'destructive-audit-'));
    const auditPath = join(tempDir, 'audit.ndjson');
    process.env.TEAM_RUNTIME_DESTRUCTIVE_AUDIT_FILE = auditPath;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'apagar o cliente 555',
        taskType: 'invoice_validation',
        conversationId: 'conv-audit-persist-1',
      },
    });
    expect(res.statusCode).toBe(200);

    const content = await readFile(auditPath, 'utf8');
    delete process.env.TEAM_RUNTIME_DESTRUCTIVE_AUDIT_FILE;
    await rm(tempDir, { recursive: true, force: true });

    const lines = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { workspaceId?: string; stage?: string; note?: string });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.workspaceId === String((ws as { _id: unknown })._id))).toBe(true);
    expect(lines.some((l) => l.stage === 'requested')).toBe(true);
    expect(lines.some((l) => /apagar o cliente 555/i.test(l.note ?? ''))).toBe(true);
  });

  it('returns destructive audit history by conversation via troubleshooting endpoint', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-audit-history-1';

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: {
        message: 'apagar o cliente 777',
        taskType: 'invoice_validation',
        conversationId,
      },
    });
    expect(runRes.statusCode).toBe(200);

    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(auditRes.statusCode).toBe(200);
    const body = JSON.parse(auditRes.body) as {
      data: { conversationId?: string; items?: Array<{ stage?: string; note?: string }>; total?: number; limit?: number; offset?: number };
    };
    expect(body.data.conversationId).toBe(conversationId);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items?.some((i) => i.stage === 'requested')).toBe(true);
    expect(body.data.items?.some((i) => /apagar o cliente 777/i.test(i.note ?? ''))).toBe(true);
    expect(typeof body.data.total).toBe('number');
    expect(body.data.limit).toBe(20);
    expect(body.data.offset).toBe(0);
  });

  it('supports destructive audit filters and pagination in troubleshooting endpoint', async () => {
    const token = await loginAndGetToken();
    const ws = await WorkspaceModel.findOne({ name: 'W' }).lean();
    const conversationId = 'conv-audit-filter-1';

    await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: { message: 'apagar o cliente 888', taskType: 'invoice_validation', conversationId },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/run`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
      payload: { message: 'confirmo', taskType: 'invoice_validation', conversationId },
    });

    const filtered = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&stage=confirmed&limit=1&offset=0`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(filtered.statusCode).toBe(200);
    const filteredBody = JSON.parse(filtered.body) as {
      data: { items?: Array<{ stage?: string }>; total?: number; limit?: number; offset?: number };
    };
    expect(filteredBody.data.items?.every((i) => i.stage === 'confirmed')).toBe(true);
    expect(filteredBody.data.limit).toBe(1);
    expect(filteredBody.data.offset).toBe(0);
    expect((filteredBody.data.total ?? 0) >= 1).toBe(true);

    const paged = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&limit=1&offset=1`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(paged.statusCode).toBe(200);
    const pagedBody = JSON.parse(paged.body) as {
      data: { items?: unknown[]; total?: number; limit?: number; offset?: number };
    };
    expect(pagedBody.data.limit).toBe(1);
    expect(pagedBody.data.offset).toBe(1);
    expect((pagedBody.data.total ?? 0) >= 2).toBe(true);
    expect((pagedBody.data.items?.length ?? 0) <= 1).toBe(true);

    const firstCursorPage = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&limit=1`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(firstCursorPage.statusCode).toBe(200);
    const firstCursorBody = JSON.parse(firstCursorPage.body) as {
      data: { items?: Array<{ at?: number }>; nextCursorAt?: number; nextCursor?: string };
    };
    const cursorAt = firstCursorBody.data.nextCursorAt;
    const nextCursor = firstCursorBody.data.nextCursor;
    expect(typeof cursorAt).toBe('number');
    expect(typeof nextCursor).toBe('string');

    const secondCursorPage = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&limit=1&cursor=${encodeURIComponent(String(nextCursor))}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(secondCursorPage.statusCode).toBe(200);
    const secondCursorBody = JSON.parse(secondCursorPage.body) as {
      data: { items?: Array<{ at?: number }>; cursor?: string };
    };
    expect(secondCursorBody.data.cursor).toBe(nextCursor);
    expect((secondCursorBody.data.items?.length ?? 0) <= 1).toBe(true);
    if (firstCursorBody.data.items?.[0]?.at && secondCursorBody.data.items?.[0]?.at) {
      expect((secondCursorBody.data.items[0].at ?? 0) < (firstCursorBody.data.items[0].at ?? 0)).toBe(true);
    }

    const invalidCursor = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&cursor=invalid-token`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(invalidCursor.statusCode).toBe(400);

    process.env.DESTRUCTIVE_AUDIT_CURSOR_TTL_SECONDS = '0';
    const shortTtlPage = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&limit=1`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    expect(shortTtlPage.statusCode).toBe(200);
    const shortTtlBody = JSON.parse(shortTtlPage.body) as { data: { nextCursor?: string } };
    const expiringCursor = shortTtlBody.data.nextCursor;
    expect(typeof expiringCursor).toBe('string');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const expiredCursorReq = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/destructive-audit?conversationId=${encodeURIComponent(conversationId)}&cursor=${encodeURIComponent(String(expiringCursor))}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': String((ws as { _id: unknown })._id),
      },
    });
    delete process.env.DESTRUCTIVE_AUDIT_CURSOR_TTL_SECONDS;
    expect(expiredCursorReq.statusCode).toBe(400);
  });
});
