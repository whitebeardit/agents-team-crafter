/**
 * Backfill idempotente: garante vault Obsidian + agente bibliotecário por workspace e reaplica política second-brain nos coordenadores.
 *
 * Uso:
 *   MONGODB_URI=... npx tsx scripts/backfill-second-brain.ts
 *   npx tsx scripts/backfill-second-brain.ts --dry-run
 */

import mongoose from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { loadEnv } from '../src/config/env.js';
import { createDeps } from '../src/config/container.js';

loadDotenv();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = loadEnv();
  const uri = env.MONGODB_URI ?? process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  const deps = createDeps(env);
  const workspaces = await deps.workspaceRepo.listAll();

  let ok = 0;
  let failed = 0;

  for (const w of workspaces) {
    if (dryRun) {
      console.log(`[dry-run] workspace ${w.id} (${w.name})`);
      ok += 1;
      continue;
    }
    try {
      await deps.librarianPlatformAgent.ensureWorkspaceSecondBrain(w.id);
      console.log(`[ok] workspace ${w.id} (${w.name})`);
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[fail] workspace ${w.id}: ${msg}`);
      failed += 1;
    }
  }

  await mongoose.disconnect();
  console.log(`Done. ok=${ok} failed=${failed} dryRun=${dryRun}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
