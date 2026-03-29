/**
 * One-off / operacional: normaliza arestas persistidas canal↔agente para o nó do coordenador
 * (mesma lógica que GET/PUT do BFF). Útil para corrigir toda a BD de uma vez.
 *
 * Uso:
 *   MONGODB_URI=... npx tsx scripts/normalize-team-graph-channel-edges.ts
 *   npx tsx scripts/normalize-team-graph-channel-edges.ts --dry-run
 */

import mongoose, { Types } from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { AgentModel } from '../src/modules/agents/infra/agent.model.js';
import { TeamGraphModel } from '../src/modules/graphs/infra/team-graph.model.js';
import { TeamModel } from '../src/modules/teams/infra/team.model.js';
import type { ITeamGraphEnrichTeam } from '../src/modules/graphs/domain/graph-enrichment.js';
import {
  normalizeGraphNodesEntityFields,
  normalizePersistedChannelEdgesToCoordinator,
  stripDerivedGraphEdges,
} from '../src/modules/graphs/domain/graph-enrichment.js';
import type { IGraphNode } from '../src/modules/graphs/domain/graph-types.js';

loadDotenv();

function notDeletedAgent() {
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

async function workspaceAgentIds(workspaceId: string): Promise<Set<string>> {
  const docs = await AgentModel.find({
    workspaceId: new Types.ObjectId(workspaceId),
    $and: [notDeletedAgent()],
  })
    .select('_id')
    .lean();
  return new Set(docs.map((d) => String((d as { _id: Types.ObjectId })._id)));
}

function teamToEnrichTeam(team: {
  coordinatorId: Types.ObjectId;
  agentIds?: Types.ObjectId[];
  channelIds?: Types.ObjectId[];
}): ITeamGraphEnrichTeam {
  return {
    coordinatorId: team.coordinatorId.toString(),
    agentIds: (team.agentIds ?? []).map((x) => x.toString()),
    channelIds: (team.channelIds ?? []).map((x) => x.toString()),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  const graphs = await TeamGraphModel.find({}).lean();
  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const g of graphs) {
    const wsId = String(g.workspaceId);
    const teamId = String(g.teamId);
    const team = await TeamModel.findOne({
      _id: new Types.ObjectId(teamId),
      workspaceId: new Types.ObjectId(wsId),
    }).lean();

    if (!team) {
      skipped += 1;
      console.warn(`skip graph teamId=${teamId}: team not found`);
      continue;
    }

    const enrichTeam = teamToEnrichTeam(team as never);
    const nodes = normalizeGraphNodesEntityFields((g.nodes as unknown[]) ?? [], enrichTeam);
    const cleanEdges = stripDerivedGraphEdges((g.edges as unknown[]) ?? []);
    const agentIds = await workspaceAgentIds(wsId);
    const { edges: fixed, changed } = normalizePersistedChannelEdgesToCoordinator(
      nodes as IGraphNode[],
      cleanEdges,
      enrichTeam,
      { agentIds },
    );

    if (!changed) {
      unchanged += 1;
      continue;
    }

    updated += 1;
    console.log(`update workspace=${wsId} teamId=${teamId} edges ${(g.edges as unknown[]).length} -> ${fixed.length}`);

    if (!dryRun) {
      await TeamGraphModel.updateOne(
        { _id: g._id },
        { $set: { nodes, edges: fixed, updatedAt: new Date() } },
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        totalGraphs: graphs.length,
        updated,
        unchanged,
        skippedNoTeam: skipped,
        dryRun,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
