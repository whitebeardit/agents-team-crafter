/**
 * One-off: normaliza campo `phone` das parties para apenas dígitos e reporta duplicatas
 * por (workspaceId, phone) antes de criar o índice único parcial em produção.
 *
 * Uso: `MONGODB_URI=... npx tsx backend/scripts/migrate-party-phones-for-unique-index.ts`
 */
import mongoose from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';

loadDotenv();
import { normalizePartyPhone } from '../src/modules/crm/domain/normalize-party-phone.js';
import { PartyModel } from '../src/modules/crm/infra/party.model.js';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI obrigatorio');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const cursor = PartyModel.find({
    phone: { $exists: true, $nin: ['', null] },
  })
    .select({ _id: 1, workspaceId: 1, phone: 1, displayName: 1 })
    .cursor();

  let updated = 0;
  let skippedInvalid = 0;
  for await (const doc of cursor) {
    const raw = typeof doc.phone === 'string' ? doc.phone : '';
    const digits = normalizePartyPhone(raw);
    if (!digits || digits.length < 8) {
      skippedInvalid += 1;
      console.warn(`[skip invalid] party=${doc._id.toString()} displayName=${doc.displayName} raw=${JSON.stringify(raw)}`);
      continue;
    }
    if (digits !== raw) {
      await PartyModel.updateOne({ _id: doc._id }, { $set: { phone: digits } }).exec();
      updated += 1;
    }
  }

  const dupes = await PartyModel.aggregate<{ _id: { ws: string; phone: string }; count: number }>([
    { $match: { phone: { $type: 'string', $gt: '' } } },
    {
      $group: {
        _id: { ws: '$workspaceId', phone: '$phone' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).exec();

  console.log(JSON.stringify({ updated, skippedInvalid, duplicateGroups: dupes.length }, null, 2));
  if (dupes.length > 0) {
    for (const d of dupes) {
      console.warn('DUPLICATE', d);
    }
    console.error('Resolva duplicatas manualmente antes de garantir o índice único.');
    process.exit(1);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
