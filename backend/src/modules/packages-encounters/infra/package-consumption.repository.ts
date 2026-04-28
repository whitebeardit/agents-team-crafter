import { Types } from 'mongoose';
import { PackageConsumptionModel } from './package-consumption.model.js';

function isMongoDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class PackageConsumptionRepository {
  async createOnce(
    workspaceId: string,
    input: {
      packageSaleId: string;
      partyId: string;
      encounterId: string;
      appointmentId?: string;
      units?: number;
      consumedAt?: Date;
    },
  ): Promise<{ created: boolean; id: string }> {
    const now = input.consumedAt ?? new Date();
    try {
      const doc = await PackageConsumptionModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        packageSaleId: new Types.ObjectId(input.packageSaleId),
        partyId: new Types.ObjectId(input.partyId),
        encounterId: new Types.ObjectId(input.encounterId),
        appointmentId: input.appointmentId ? new Types.ObjectId(input.appointmentId) : undefined,
        consumedAt: now,
        units: typeof input.units === 'number' && input.units > 0 ? input.units : 1,
      });
      return { created: true, id: doc._id.toString() };
    } catch (err) {
      if (isMongoDuplicateKey(err)) {
        const existing = (await PackageConsumptionModel.findOne({
          workspaceId: new Types.ObjectId(workspaceId),
          packageSaleId: new Types.ObjectId(input.packageSaleId),
          encounterId: new Types.ObjectId(input.encounterId),
        })
          .select('_id')
          .lean()) as { _id?: unknown } | null;
        if (existing?._id) return { created: false, id: String(existing._id) };
      }
      throw err;
    }
  }
}

