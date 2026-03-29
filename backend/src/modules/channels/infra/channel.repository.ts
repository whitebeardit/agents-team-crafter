import { Types } from 'mongoose';
import { ChannelModel } from './channel.model.js';
import type { ChannelDoc } from './channel.model.js';
import type { IEncryptedPayload } from '../../../utils/secrets-crypto.js';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function mockChannelConnect(type: ChannelDoc['type']) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (type === 'whatsapp') {
    return { status: 'connecting' as const, qrCode: TINY_PNG, expiresAt };
  }
  if (type === 'slack') {
    return {
      status: 'connecting' as const,
      authUrl: 'https://slack.com/oauth/v2/authorize?client_id=mock&scope=channels:read',
      expiresAt,
    };
  }
  if (type === 'email') {
    return {
      status: 'connecting' as const,
      message: 'Verifique a caixa de entrada do e-mail de configuracao para confirmar.',
      expiresAt,
    };
  }
  return {
    status: 'connecting' as const,
    endpoint: 'reachable',
    expiresAt,
  };
}

export function mockChannelTest() {
  return {
    status: 'ok' as const,
    latency: Math.floor(Math.random() * 200) + 50,
    message: 'Conexao funcionando corretamente',
  };
}

function toListItem(doc: ChannelDoc) {
  const p = (doc as { provider?: string }).provider;
  const plat = (doc as { platform?: string }).platform;
  return {
    id: doc._id.toString(),
    type: doc.type,
    provider: p === 'chat_sdk' ? 'chat_sdk' : 'native',
    platform: plat,
    name: doc.name,
    status: doc.status,
    teamId: doc.teamId ? (doc.teamId as Types.ObjectId).toString() : undefined,
    config: (doc.config as Record<string, unknown>) ?? {},
  };
}

export class ChannelRepository {
  async listAllIds(workspaceId: string): Promise<Set<string>> {
    const docs = await ChannelModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .select('_id')
      .lean();
    return new Set(docs.map((d) => String((d as { _id: unknown })._id)));
  }

  async existsAll(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return true;
    const count = await ChannelModel.countDocuments({
      _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return count === ids.length;
  }

  async listByIds(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return ChannelModel.find({
      _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
      workspaceId: new Types.ObjectId(workspaceId),
    }).lean();
  }

  async list(
    workspaceId: string,
    filters: { type?: string; status?: string; teamId?: string },
  ) {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filters.type) q.type = filters.type;
    if (filters.status) q.status = filters.status;
    if (filters.teamId) q.teamId = new Types.ObjectId(filters.teamId);
    const docs = await ChannelModel.find(q).sort({ name: 1 }).exec();
    return docs.map((d) => toListItem(d as ChannelDoc));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await ChannelModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? (doc as ChannelDoc) : null;
  }

  async create(
    workspaceId: string,
    input: {
      type: ChannelDoc['type'];
      name: string;
      teamId?: string;
      provider?: 'native' | 'chat_sdk';
      platform?: string;
      config: Record<string, unknown>;
    },
  ) {
    const payload: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      type: input.type,
      provider: input.provider ?? 'native',
      ...(input.platform !== undefined ? { platform: input.platform } : {}),
      name: input.name,
      status: 'pending',
      config: input.config,
    };
    if (input.teamId) payload.teamId = new Types.ObjectId(input.teamId);
    const doc = await ChannelModel.create(payload);
    const d = doc as ChannelDoc;
    return {
      id: d._id.toString(),
      type: d.type,
      provider: (d as { provider?: string }).provider === 'chat_sdk' ? 'chat_sdk' : 'native',
      platform: (d as { platform?: string }).platform,
      name: d.name,
      status: d.status,
      config: (d.config as Record<string, unknown>) ?? {},
    };
  }

  async findByWorkspaceAndSlackTeamId(workspaceId: string, slackTeamId: string) {
    const doc = await ChannelModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      type: 'slack',
      'config.slackTeamId': slackTeamId,
    }).exec();
    return doc ? (doc as ChannelDoc) : null;
  }

  /** Canais Chat SDK de uma plataforma (ex.: todos Slack do workspace). */
  async listChatSdkByPlatform(workspaceId: string, platform: string): Promise<ChannelDoc[]> {
    const docs = await ChannelModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      provider: 'chat_sdk',
      platform,
    }).exec();
    return docs.map((d) => d as ChannelDoc);
  }

  async findByChatSdkRouting(
    workspaceId: string,
    platform: string,
    configField: string,
    value: string,
  ): Promise<ChannelDoc | null> {
    const q: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      provider: 'chat_sdk',
      platform,
    };
    q[`config.${configField}`] = value;
    const doc = await ChannelModel.findOne(q).exec();
    return doc ? (doc as ChannelDoc) : null;
  }

  async setSecretsEncrypted(workspaceId: string, id: string, payload: IEncryptedPayload) {
    const doc = await ChannelModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { secretsEncrypted: payload } },
      { new: true },
    ).exec();
    return doc ? (doc as ChannelDoc) : null;
  }

  async update(
    workspaceId: string,
    id: string,
    input: {
      name?: string;
      teamId?: string | null;
      provider?: 'native' | 'chat_sdk';
      platform?: string | null;
      config?: Record<string, unknown>;
    },
  ) {
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.provider !== undefined) set.provider = input.provider;
    if (input.platform === null) set.platform = undefined;
    else if (input.platform !== undefined) set.platform = input.platform;
    if (input.teamId === null) set.teamId = null;
    else if (input.teamId !== undefined) set.teamId = new Types.ObjectId(input.teamId);
    if (input.config !== undefined) set.config = input.config;
    const doc = await ChannelModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: set },
      { new: true },
    ).exec();
    if (!doc) return null;
    const d = doc as ChannelDoc;
    return {
      id: d._id.toString(),
      type: d.type,
      provider: (d as { provider?: string }).provider === 'chat_sdk' ? 'chat_sdk' : 'native',
      platform: (d as { platform?: string }).platform,
      name: d.name,
      status: d.status,
      config: (d.config as Record<string, unknown>) ?? {},
    };
  }

  async delete(workspaceId: string, id: string) {
    const r = await ChannelModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return r.deletedCount === 1;
  }

  async disconnect(workspaceId: string, id: string) {
    const doc = await ChannelModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status: 'disconnected', disconnectedAt: new Date(), connectedAt: null } },
      { new: true },
    ).exec();
    if (!doc) return null;
    const d = doc as ChannelDoc;
    return {
      id: d._id.toString(),
      status: d.status,
      disconnectedAt: (d.disconnectedAt ?? new Date()).toISOString(),
    };
  }

  /** Marca canal como conectado (mock pos-“setup”). */
  async markConnected(workspaceId: string, id: string) {
    const metrics = { messagesLast24h: Math.floor(Math.random() * 2000), avgResponseTime: '1m 45s' };
    await ChannelModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status: 'connected', connectedAt: new Date(), metrics } },
    ).exec();
  }
}
