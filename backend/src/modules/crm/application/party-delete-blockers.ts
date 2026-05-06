import { Types } from 'mongoose';
import { AppointmentModel } from '../../scheduling/infra/appointment.model.js';
import { CareSubjectModel } from '../../care/infra/care-subject.model.js';
import { ServiceOrderModel } from '../../services-sales/infra/service-order.model.js';
import { PackageSaleModel } from '../../packages-encounters/infra/package-sale.model.js';
import { EncounterModel } from '../../packages-encounters/infra/encounter.model.js';
import { ReceivableModel } from '../../finance/infra/receivable.model.js';
import { PayableModel } from '../../finance/infra/payable.model.js';

export type IPartyDeleteBlocker = { domain: string; count: number };

/**
 * Contagens por domínio quando `partyId` ainda é referenciado (bloqueia DELETE duro).
 */
export async function getPartyDeleteBlockers(
  workspaceId: string,
  partyId: string,
): Promise<IPartyDeleteBlocker[]> {
  const wid = new Types.ObjectId(workspaceId);
  const pid = new Types.ObjectId(partyId);
  const [
    appointments,
    careSubjects,
    serviceOrders,
    packageSales,
    encounters,
    receivables,
    payables,
  ] = await Promise.all([
    AppointmentModel.countDocuments({ workspaceId: wid, partyId: pid }),
    CareSubjectModel.countDocuments({ workspaceId: wid, partyId: pid }),
    ServiceOrderModel.countDocuments({ workspaceId: wid, partyId: pid }),
    PackageSaleModel.countDocuments({ workspaceId: wid, partyId: pid }),
    EncounterModel.countDocuments({ workspaceId: wid, partyId: pid }),
    ReceivableModel.countDocuments({ workspaceId: wid, partyId: pid }),
    PayableModel.countDocuments({ workspaceId: wid, destinationPartyId: pid }),
  ]);
  const out: IPartyDeleteBlocker[] = [];
  if (appointments > 0) out.push({ domain: 'appointments', count: appointments });
  if (careSubjects > 0) out.push({ domain: 'careSubjects', count: careSubjects });
  if (serviceOrders > 0) out.push({ domain: 'serviceOrders', count: serviceOrders });
  if (packageSales > 0) out.push({ domain: 'packageSales', count: packageSales });
  if (encounters > 0) out.push({ domain: 'encounters', count: encounters });
  if (receivables > 0) out.push({ domain: 'receivables', count: receivables });
  if (payables > 0) out.push({ domain: 'payables', count: payables });
  return out;
}
