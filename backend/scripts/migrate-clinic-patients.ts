import mongoose from 'mongoose';
import { WorkspaceModel } from '../src/modules/workspaces/infra/workspace.model.js';
import { PartyModel } from '../src/modules/crm/infra/party.model.js';
import { CareSubjectModel } from '../src/modules/care/infra/care-subject.model.js';
import { normalizePartyPhone } from '../src/modules/crm/domain/normalize-party-phone.js';

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI obrigatorio (ex.: export MONGODB_URI=mongodb://localhost:27017/db)');
  }
  await mongoose.connect(uri);

  const workspaces = await WorkspaceModel.find({}).select('_id name').lean();
  console.log(`workspaces: ${workspaces.length}`);

  let createdSubjects = 0;
  let normalizedPhones = 0;
  let duplicates = 0;

  for (const ws of workspaces) {
    const workspaceId = String(ws._id);
    const parties = await PartyModel.find({ workspaceId: ws._id }).select('_id displayName phone roles').lean();
    const byPhone = new Map<string, string>();
    for (const p of parties) {
      const phoneRaw = typeof p.phone === 'string' ? p.phone : '';
      const digits = phoneRaw ? normalizePartyPhone(phoneRaw) : '';
      if (phoneRaw && digits && digits !== phoneRaw) {
        await PartyModel.updateOne({ _id: p._id }, { $set: { phone: digits } }).exec();
        normalizedPhones += 1;
      }
      if (digits) {
        if (byPhone.has(digits) && byPhone.get(digits) !== String(p._id)) duplicates += 1;
        else byPhone.set(digits, String(p._id));
      }
    }

    for (const p of parties) {
      const existing = await CareSubjectModel.findOne({
        workspaceId: ws._id,
        partyId: p._id,
        subjectKind: 'psych',
      })
        .select('_id')
        .lean();
      if (existing?._id) continue;
      await CareSubjectModel.create({
        workspaceId: ws._id,
        partyId: p._id,
        name: typeof p.displayName === 'string' ? p.displayName : 'Paciente',
        subjectKind: 'psych',
      });
      createdSubjects += 1;
    }
    console.log(`workspace ${workspaceId} (${String(ws.name)}): parties=${parties.length}`);
  }

  console.log(
    JSON.stringify(
      { ok: true, createdSubjects, normalizedPhones, duplicatesDetected: duplicates },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* disconnect best-effort */
  }
  process.exit(1);
});

