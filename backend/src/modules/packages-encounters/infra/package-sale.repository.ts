import { Types } from 'mongoose';
import { PackageSaleModel } from './package-sale.model.js';

export class PackageSaleRepository {
  async create(
    workspaceId: string,
    input: { partyId: string; packageName: string; unitsTotal: number },
  ) {
    const doc = await PackageSaleModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      packageName: input.packageName.trim(),
      unitsTotal: input.unitsTotal,
      unitsUsed: 0,
    });
    return this.pub(doc);
  }

  async getBalance(workspaceId: string, packageSaleId: string) {
    const doc = await PackageSaleModel.findOne({
      _id: packageSaleId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      remaining: doc.unitsTotal - doc.unitsUsed,
      unitsTotal: doc.unitsTotal,
      unitsUsed: doc.unitsUsed,
    };
  }

  async findById(workspaceId: string, packageSaleId: string) {
    const doc = await PackageSaleModel.findOne({
      _id: packageSaleId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.pub(doc) : null;
  }

  async consumeUnit(workspaceId: string, packageSaleId: string) {
    const doc = await PackageSaleModel.findOneAndUpdate(
      {
        _id: packageSaleId,
        workspaceId: new Types.ObjectId(workspaceId),
        $expr: { $lt: ['$unitsUsed', '$unitsTotal'] },
      },
      { $inc: { unitsUsed: 1 } },
      { new: true },
    ).exec();
    return doc ? this.pub(doc) : null;
  }

  private pub(doc: { _id: Types.ObjectId; unitsTotal: number; unitsUsed: number; packageName: string }) {
    return {
      id: doc._id.toString(),
      packageName: doc.packageName,
      unitsTotal: doc.unitsTotal,
      unitsUsed: doc.unitsUsed,
      remaining: doc.unitsTotal - doc.unitsUsed,
    };
  }
}
