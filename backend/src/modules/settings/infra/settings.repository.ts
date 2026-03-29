import { Types } from 'mongoose';
import { WorkspaceModel } from '../../workspaces/infra/workspace.model.js';
import type { WorkspaceDoc } from '../../workspaces/infra/workspace.model.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import { AgentModel } from '../../agents/infra/agent.model.js';
import { ChannelModel } from '../../channels/infra/channel.model.js';

export class SettingsRepository {
  async getWorkspace(workspaceId: string) {
    const doc = await WorkspaceModel.findById(workspaceId);
    if (!doc) return null;
    const ws = doc as WorkspaceDoc;
    const id = new Types.ObjectId(workspaceId);
    const [usedTeams, usedAgents, usedChannels] = await Promise.all([
      TeamModel.countDocuments({ workspaceId: id }),
      AgentModel.countDocuments({
        workspaceId: id,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
      ChannelModel.countDocuments({ workspaceId: id }),
    ]);
    const limitsRaw = (ws.limits as Record<string, unknown>) ?? {};
    return {
      id: workspaceId,
      name: ws.name,
      logo: ws.logo ?? undefined,
      plan: ws.plan,
      settings: (ws.settings as Record<string, unknown>) ?? {},
      limits: {
        maxTeams: (limitsRaw['maxTeams'] as number) ?? -1,
        maxAgents: (limitsRaw['maxAgents'] as number) ?? -1,
        maxChannels: (limitsRaw['maxChannels'] as number) ?? -1,
        usedTeams,
        usedAgents,
        usedChannels,
      },
    };
  }
}
