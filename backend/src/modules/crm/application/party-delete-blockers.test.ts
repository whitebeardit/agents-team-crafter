import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getPartyDeleteBlockers } from './party-delete-blockers.js';
import { AppointmentModel } from '../../scheduling/infra/appointment.model.js';
import { CareSubjectModel } from '../../care/infra/care-subject.model.js';
import { ServiceOrderModel } from '../../services-sales/infra/service-order.model.js';
import { PackageSaleModel } from '../../packages-encounters/infra/package-sale.model.js';
import { EncounterModel } from '../../packages-encounters/infra/encounter.model.js';
import { ReceivableModel } from '../../finance/infra/receivable.model.js';
import { PayableModel } from '../../finance/infra/payable.model.js';

describe('getPartyDeleteBlockers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes payables in blocking references', async () => {
    jest.spyOn(AppointmentModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(CareSubjectModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(ServiceOrderModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(PackageSaleModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(EncounterModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(ReceivableModel, 'countDocuments').mockResolvedValue(1 as never);
    jest.spyOn(PayableModel, 'countDocuments').mockResolvedValue(2 as never);

    const out = await getPartyDeleteBlockers('507f1f77bcf86cd799439011', '507f191e810c19729de860ea');

    expect(out).toEqual([
      { domain: 'receivables', count: 1 },
      { domain: 'payables', count: 2 },
    ]);
  });
});
