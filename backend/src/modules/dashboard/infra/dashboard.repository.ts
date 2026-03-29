import { Types } from 'mongoose';
import { TeamModel } from '../../teams/infra/team.model.js';
import { AgentModel } from '../../agents/infra/agent.model.js';
import { ChannelModel } from '../../channels/infra/channel.model.js';
import { TemplateModel } from '../../templates/infra/template.model.js';

export class DashboardRepository {
  async metrics(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const [activeTeams, agentDocs, templates] = await Promise.all([
      TeamModel.countDocuments({ workspaceId: ws, status: 'active' }),
      AgentModel.countDocuments({
        workspaceId: ws,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
        status: { $ne: 'archived' },
      }),
      TemplateModel.countDocuments({ workspaceId: ws }),
    ]);

    return {
      activeTeams,
      availableAgents: agentDocs,
      connectedChannels: await ChannelModel.countDocuments({ workspaceId: ws, status: 'connected' }),
      templates,
      conversationsToday: Math.floor(Math.random() * 500) + 100,
      conversationsGrowth: Number((Math.random() * 20).toFixed(1)),
      avgResponseTime: '2m 15s',
      satisfactionRate: Number((90 + Math.random() * 9).toFixed(1)),
    };
  }

  async recentTeams(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const docs = await TeamModel.find({ workspaceId: ws }).sort({ updatedAt: -1 }).limit(8).lean();
    return docs.map((t) => {
      const x = t as unknown as {
        _id: Types.ObjectId;
        name: string;
        status: string;
        updatedAt?: Date;
        agentIds?: Types.ObjectId[];
      };
      return {
        id: x._id.toString(),
        name: x.name,
        status: x.status,
        lastActivity: (x.updatedAt ?? new Date()).toISOString(),
        agentCount: (x.agentIds ?? []).length,
        conversationsToday: Math.floor(Math.random() * 200),
      };
    });
  }

  async alerts(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const out: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      actionUrl: string;
      createdAt: string;
    }> = [];

    const disconnected = await ChannelModel.find({ workspaceId: ws, status: 'disconnected' })
      .limit(3)
      .lean();
    for (const ch of disconnected) {
      const c = ch as { _id: Types.ObjectId; name?: string };
      out.push({
        id: `alert-ch-${c._id.toString()}`,
        type: 'warning',
        title: 'Canal desconectado',
        message: `O canal ${c.name ?? ''} esta desconectado`,
        actionUrl: '/channels',
        createdAt: new Date().toISOString(),
      });
    }

    const drafts = await TeamModel.find({ workspaceId: ws, status: 'draft' }).limit(2).lean();
    for (const tm of drafts) {
      const t = tm as { _id: Types.ObjectId; name?: string; createdAt?: Date };
      out.push({
        id: `alert-team-${t._id.toString()}`,
        type: 'info',
        title: 'Time em rascunho',
        message: `O time '${t.name ?? ''}' esta pendente de ativacao`,
        actionUrl: `/teams/${t._id.toString()}`,
        createdAt: (t.createdAt ?? new Date()).toISOString(),
      });
    }

    if (out.length === 0) {
      out.push({
        id: 'alert-default',
        type: 'info',
        title: 'Tudo certo',
        message: 'Nenhum alerta critico no momento',
        actionUrl: '/dashboard',
        createdAt: new Date().toISOString(),
      });
    }

    return out;
  }
}
