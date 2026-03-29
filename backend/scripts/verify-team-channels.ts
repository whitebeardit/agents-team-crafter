/**
 * Verifica times ativos, ligacao a canais e conflitos 1:1 (MVP).
 * Uso: npm run verify:team-channels
 * Env: MONGODB_URI (obrigatorio), WORKSPACE_ID ou WORKSPACE_NAME (opcional; default nome "Workspace Alpha" do seed).
 */
import mongoose, { Types } from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';

loadDotenv();
import { WorkspaceModel } from '../src/modules/workspaces/infra/workspace.model.js';
import { TeamModel } from '../src/modules/teams/infra/team.model.js';
import { ChannelModel } from '../src/modules/channels/infra/channel.model.js';

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
  await mongoose.connect(uri);

  const wsId = process.env.WORKSPACE_ID?.trim();
  const wsName = process.env.WORKSPACE_NAME?.trim() ?? 'Workspace Alpha';

  let ws = wsId
    ? await WorkspaceModel.findById(wsId).lean()
    : await WorkspaceModel.findOne({ name: wsName }).lean();
  if (!ws) {
    console.error('Workspace nao encontrado. Defina WORKSPACE_ID ou WORKSPACE_NAME.');
    process.exit(1);
  }

  const wid = String((ws as { _id: unknown })._id);
  console.log(`Workspace: ${(ws as { name?: string }).name} (${wid})\n`);

  const teams = await TeamModel.find({ workspaceId: new Types.ObjectId(wid) }).lean();
  for (const t of teams) {
    const doc = t as {
      _id: unknown;
      name?: string;
      status?: string;
      coordinatorId?: unknown;
      channelIds?: unknown[];
    };
    const chIds = (doc.channelIds ?? []).map((x) => String(x));
    console.log(`Team: ${doc.name ?? doc._id}`);
    console.log(`  status: ${doc.status ?? '?'}`);
    console.log(`  coordinatorId: ${String(doc.coordinatorId ?? '')}`);
    console.log(`  channelIds (${chIds.length}): ${chIds.join(', ') || '(nenhum)'}`);

    for (const cid of chIds) {
      const ch = await ChannelModel.findById(cid).lean();
      if (!ch) {
        console.log(`  [WARN] canal ${cid} nao encontrado`);
        continue;
      }
      const c = ch as { name?: string; type?: string; platform?: string; provider?: string };
      console.log(
        `    -> ${cid}: ${c.name ?? c.type} (type=${c.type ?? '?'}, platform=${c.platform ?? '?'}, provider=${c.provider ?? '?'})`,
      );
    }
    console.log('');
  }

  const active = teams.filter((x) => (x as { status?: string }).status === 'active');
  const channelToTeams = new Map<string, string[]>();
  for (const t of active) {
    const doc = t as { _id: unknown; name?: string; channelIds?: unknown[] };
    const name = doc.name ?? String(doc._id);
    for (const cid of doc.channelIds ?? []) {
      const s = String(cid);
      const arr = channelToTeams.get(s) ?? [];
      arr.push(name);
      channelToTeams.set(s, arr);
    }
  }
  let conflict = false;
  for (const [cid, names] of channelToTeams) {
    if (names.length > 1) {
      conflict = true;
      console.error(`[ERRO] Canal ${cid} em ${names.length} times ativos: ${names.join(', ')}`);
    }
  }
  if (!conflict && active.some((t) => ((t as { channelIds?: unknown[] }).channelIds ?? []).length > 0)) {
    console.log('OK: nenhum channelId partilhado entre dois times ativos.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
