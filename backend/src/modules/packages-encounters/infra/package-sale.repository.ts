import { Types } from 'mongoose';
import { PackageSaleModel } from './package-sale.model.js';
import { resolveRecordOrigin, type TRecordOrigin } from '../../../shared/kernel/record-origin.js';

export class PackageSaleRepository {
  async create(
    workspaceId: string,
    input: {
      partyId: string;
      packageName: string;
      unitsTotal: number;
      packageProductId?: string;
      productSlug?: string;
      priceCentsAtSale?: number;
      origin?: Partial<TRecordOrigin>;
      teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
      correlationId?: string;
    },
  ) {
    const origin = resolveRecordOrigin({
      explicit: input.origin,
      teamContext: input.teamContext,
      correlationId: input.correlationId,
      fallbackSlug: 'packages_sale',
    });
    const doc = await PackageSaleModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      packageName: input.packageName.trim(),
      unitsTotal: input.unitsTotal,
      unitsUsed: 0,
      packageProductId: input.packageProductId ? new Types.ObjectId(input.packageProductId) : undefined,
      productSlug: input.productSlug?.trim().toLowerCase(),
      priceCentsAtSale: input.priceCentsAtSale,
      origin,
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

  async listByDateRange(
    workspaceId: string,
    input: { startDate: string; endDate: string; limit?: number },
  ) {
    const cap = Math.min(Math.max(1, input.limit ?? 300), 1000);
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T23:59:59.999Z`);
    const docs = await PackageSaleModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .limit(cap)
      .exec();
    return docs.map((doc) => this.pub(doc));
  }

  async deleteById(workspaceId: string, packageSaleId: string): Promise<boolean> {
    const res = await PackageSaleModel.deleteOne({
      _id: packageSaleId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return (res.deletedCount ?? 0) > 0;
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
    packageProductId?: Types.ObjectId;
    productSlug?: string;
    priceCentsAtSale?: number;
    origin: TRecordOrigin;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      packageName: doc.packageName,
      unitsTotal: doc.unitsTotal,
      unitsUsed: doc.unitsUsed,
      remaining: doc.unitsTotal - doc.unitsUsed,
      packageProductId: doc.packageProductId?.toString(),
      productSlug: doc.productSlug,
      priceCentsAtSale: doc.priceCentsAtSale,
      origin: doc.origin,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
