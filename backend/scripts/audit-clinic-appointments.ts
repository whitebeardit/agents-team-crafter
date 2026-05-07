import mongoose from 'mongoose';
import { WorkspaceModel } from '../src/modules/workspaces/infra/workspace.model.js';
import { AppointmentModel } from '../src/modules/scheduling/infra/appointment.model.js';
import { EncounterModel } from '../src/modules/packages-encounters/infra/encounter.model.js';

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI obrigatorio (ex.: export MONGODB_URI=mongodb://localhost:27017/db)');
  }
  await mongoose.connect(uri);

  const workspaces = await WorkspaceModel.find({}).select('_id name').lean();
  console.log(`workspaces: ${workspaces.length}`);

  const report: Array<Record<string, unknown>> = [];

  for (const ws of workspaces) {
    const workspaceId = String(ws._id);
    const appts = await AppointmentModel.find({ workspaceId: ws._id }).lean();
    const withoutCareSubject = appts.filter((a) => !a.careSubjectId).length;
    const withoutPackageSale = appts.filter((a) => !a.packageSaleId).length;
    const completedWithoutEncounter = appts.filter((a) => a.status === 'completed' && !a.encounterId).length;

    const encounters = await EncounterModel.find({ workspaceId: ws._id }).lean();
    const encounterWithoutAppointment = encounters.filter((e) => {
      const doc = e as Record<string, unknown>;
      if (!('appointmentId' in doc)) return true;
      const aid = doc['appointmentId'];
      return aid == null || aid === '';
    }).length;

    report.push({
      workspaceId,
      name: String(typeof (ws as { name?: unknown }).name === 'string' ? (ws as { name: string }).name : ''),
      totalAppointments: appts.length,
      withoutCareSubject,
      withoutPackageSale,
      completedWithoutEncounter,
      totalEncounters: encounters.length,
      encounterWithoutAppointment,
    });
  }

  console.log(JSON.stringify({ ok: true, report }, null, 2));
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

