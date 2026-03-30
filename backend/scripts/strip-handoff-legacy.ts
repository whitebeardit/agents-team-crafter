/**
 * Migração one-off: remove handoff e flags legadas de delegação nos agentes;
 * remove arestas handoff persistidas nos grafos de time.
 *
 * Uso:
 *   MONGODB_URI=... npx tsx scripts/strip-handoff-legacy.ts
 *   npx tsx scripts/strip-handoff-legacy.ts --dry-run
 */

import mongoose from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { AgentModel } from '../src/modules/agents/infra/agent.model.js';
import { TeamGraphModel } from '../src/modules/graphs/infra/team-graph.model.js';

loadDotenv();

function isPersistedHandoffEdge(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const rec = e as Record<string, unknown>;
  const id = String(rec.id ?? '');
  if (id.startsWith('derived-handoff-') || id.startsWith('handoff-')) return true;
  const data = rec.data as Record<string, unknown> | undefined;
  return data?.edgeKind === 'handoff';
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  let agentsUpdated = 0;
  let graphsUpdated = 0;

  const agentCursor = AgentModel.find({}).cursor();
  for await (const raw of agentCursor) {
    const doc = raw as mongoose.Document & { capabilities?: Record<string, unknown> };
    const row = doc.toObject() as Record<string, unknown>;
    const handoffVal = row['handoff'];
    const hasHandoff = handoffVal != null;
    const cap = doc.capabilities;
    const stripCap =
      cap &&
      (Object.prototype.hasOwnProperty.call(cap, 'canDelegate') ||
        Object.prototype.hasOwnProperty.call(cap, 'canReceiveHandoff'));

    if (!hasHandoff && !stripCap) continue;

    const patch: Record<string, unknown> = {};
    if (hasHandoff) {
      patch.$unset = { handoff: '' };
    }
    if (stripCap && cap) {
      const next = { ...cap };
      delete next.canDelegate;
      delete next.canReceiveHandoff;
      patch.$set = { ...(patch.$set as object), capabilities: next };
    }

    if (dryRun) {
      console.log(`[dry-run] agent ${String(doc._id)} would update`, Object.keys(patch));
      agentsUpdated += 1;
      continue;
    }
    await AgentModel.updateOne({ _id: doc._id }, patch as mongoose.UpdateQuery<unknown>);
    agentsUpdated += 1;
  }

  const graphs = await TeamGraphModel.find({}).lean();
  for (const g of graphs) {
    const edges = (g.edges as unknown[]) ?? [];
    const filtered = edges.filter((e) => !isPersistedHandoffEdge(e));
    if (filtered.length === edges.length) continue;
    if (dryRun) {
      console.log(
        `[dry-run] teamGraph teamId=${String(g.teamId)} would remove ${edges.length - filtered.length} edges`,
      );
      graphsUpdated += 1;
      continue;
    }
    await TeamGraphModel.updateOne({ _id: g._id }, { $set: { edges: filtered } });
    graphsUpdated += 1;
  }

  console.log(
    dryRun
      ? `[dry-run] agents to touch: ${agentsUpdated}, graphs to touch: ${graphsUpdated}`
      : `Done. agents updated: ${agentsUpdated}, graphs updated: ${graphsUpdated}`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
