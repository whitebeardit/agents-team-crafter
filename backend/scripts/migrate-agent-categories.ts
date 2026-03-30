/**
 * Migração one-off: normaliza agent.category para slug canónico (normalizeAgentCategory).
 *
 * Uso:
 *   MONGODB_URI=... npx tsx scripts/migrate-agent-categories.ts
 *   npx tsx scripts/migrate-agent-categories.ts --dry-run
 */

import mongoose from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { AgentModel } from '../src/modules/agents/infra/agent.model.js';
import { normalizeAgentCategory } from '../src/shared/utils/agent-category.js';

loadDotenv();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  let updated = 0;
  const cursor = AgentModel.find({
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  }).cursor();

  for await (const raw of cursor) {
    const doc = raw as mongoose.Document & { category?: string };
    const cur = String(doc.category ?? '');
    const next = normalizeAgentCategory(cur);
    if (next === cur) continue;

    if (dryRun) {
      console.log(`[dry-run] agent ${String(doc._id)} "${cur}" -> "${next}"`);
      updated += 1;
      continue;
    }
    await AgentModel.updateOne({ _id: doc._id }, { $set: { category: next } });
    updated += 1;
  }

  console.log(
    dryRun ? `[dry-run] ${updated} agent(s) would be updated` : `Updated ${updated} agent(s)`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
