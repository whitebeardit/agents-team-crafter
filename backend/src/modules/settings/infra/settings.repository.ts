import { Types } from 'mongoose';
import { WorkspaceModel } from '../../workspaces/infra/workspace.model.js';
import type { WorkspaceDoc } from '../../workspaces/infra/workspace.model.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import { AgentModel } from '../../agents/infra/agent.model.js';
import { ChannelModel } from '../../channels/infra/channel.model.js';
import { resolveEffectiveMaxLimits } from '../../workspaces/application/workspace-plan-limits.js';

export class SettingsRepository {
  /** Contagens de uso para quotas (teams, agentes activos, canais). */
  async countWorkspaceUsage(workspaceId: string): Promise<{
    usedTeams: number;
    usedAgents: number;
    usedChannels: number;
  }> {
    const id = new Types.ObjectId(workspaceId);
    const [usedTeams, usedAgents, usedChannels] = await Promise.all([
      TeamModel.countDocuments({ workspaceId: id }),
      AgentModel.countDocuments({
        workspaceId: id,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
      ChannelModel.countDocuments({ workspaceId: id }),
    ]);
    return { usedTeams, usedAgents, usedChannels };
  }

  async getWorkspace(workspaceId: string) {
    const doc = await WorkspaceModel.findById(workspaceId);
    if (!doc) return null;
    const ws = doc as WorkspaceDoc;
    const { usedTeams, usedAgents, usedChannels } = await this.countWorkspaceUsage(workspaceId);
    const limitsRaw = (ws.limits as Record<string, unknown>) ?? {};
    const effective = resolveEffectiveMaxLimits(ws.plan, limitsRaw);
    return {
      id: workspaceId,
      name: ws.name,
      logo: ws.logo ?? undefined,
      plan: ws.plan,
      settings: (ws.settings as Record<string, unknown>) ?? {},
      limits: {
        maxTeams: effective.maxTeams,
        maxAgents: effective.maxAgents,
        maxChannels: effective.maxChannels,
        usedTeams,
        usedAgents,
        usedChannels,
      },
    };
  }
}
