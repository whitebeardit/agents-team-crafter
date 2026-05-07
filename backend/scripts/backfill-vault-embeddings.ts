/**
 * Backfill de embeddings por nota (idempotente via embedNoteIfStale / contentHash).
 *
 * Uso:
 *   EMBEDDINGS_ENABLED=1 OPENAI_API_KEY=sk-... MONGODB_URI=... npx tsx scripts/backfill-vault-embeddings.ts
 *   npx tsx scripts/backfill-vault-embeddings.ts --dry-run
 */

import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { loadEnv } from '../src/config/env.js';
import { createDeps } from '../src/config/container.js';
import { VaultNoteIndexModel } from '../src/modules/team-vault/infra/vault-note-index.model.js';

loadDotenv();

const BATCH_DELAY_MS = Number(process.env.EMBEDDINGS_BACKFILL_DELAY_MS ?? 60);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = loadEnv();
  const uri = env.MONGODB_URI ?? process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);
  const deps = createDeps(env);

  if (!deps.vaultEmbedding.isEnabled()) {
    console.error('Defina EMBEDDINGS_ENABLED=1 e OPENAI_API_KEY para executar o backfill de embeddings.');
    process.exit(1);
  }

  const workspaces = await deps.workspaceRepo.listAll();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of workspaces) {
    const wid = w.id;
    const cursor = VaultNoteIndexModel.find({
      workspaceId: new Types.ObjectId(wid),
      status: { $in: ['active', 'proposed'] },
    })
      .select({ noteId: 1 })
      .cursor();

    for await (const doc of cursor) {
      const noteId = String((doc as { noteId: string }).noteId);
      if (dryRun) {
        console.log(`[dry-run] ${wid} ${noteId}`);
        skipped += 1;
        continue;
      }
      try {
        await deps.vaultEmbedding.embedNoteIfStale(wid, noteId);
        ok += 1;
        if (BATCH_DELAY_MS > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[fail] workspace=${wid} note=${noteId}: ${msg}`);
        failed += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      { workspaces: workspaces.length, embeddedAttempts: ok, dryRunSkipped: skipped, failed },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
