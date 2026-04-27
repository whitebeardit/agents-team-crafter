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

  async listByParty(workspaceId: string, partyId: string) {
    const docs = await PackageSaleModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((doc) => this.pub(doc));
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

  async goldGateSnapshot(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const [sales, totals] = await Promise.all([
      PackageSaleModel.aggregate<{ _id: null; totalSales: number; fullyConsumedSales: number }>([
        { $match: { workspaceId: ws } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            fullyConsumedSales: {
              $sum: {
                $cond: [{ $gte: ['$unitsUsed', '$unitsTotal'] }, 1, 0],
              },
            },
          },
        },
      ]),
      PackageSaleModel.aggregate<{ _id: null; unitsTotal: number; unitsUsed: number }>([
        { $match: { workspaceId: ws } },
        {
          $group: {
            _id: null,
            unitsTotal: { $sum: '$unitsTotal' },
            unitsUsed: { $sum: '$unitsUsed' },
          },
        },
      ]),
    ]);
    const totalSales = sales[0]?.totalSales ?? 0;
    const fullyConsumedSales = sales[0]?.fullyConsumedSales ?? 0;
    const unitsTotal = totals[0]?.unitsTotal ?? 0;
    const unitsUsed = totals[0]?.unitsUsed ?? 0;
    return {
      totalSales,
      fullyConsumedSales,
      activeSales: Math.max(0, totalSales - fullyConsumedSales),
      unitsTotal,
      unitsUsed,
      unitsRemaining: Math.max(0, unitsTotal - unitsUsed),
    };
  }

  private pub(doc: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    unitsTotal: number;
    unitsUsed: number;
    packageName: string;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      packageName: doc.packageName,
      unitsTotal: doc.unitsTotal,
      unitsUsed: doc.unitsUsed,
      remaining: doc.unitsTotal - doc.unitsUsed,
    };
  }
}
