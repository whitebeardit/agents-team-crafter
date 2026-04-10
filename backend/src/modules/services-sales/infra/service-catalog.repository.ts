import { Types } from 'mongoose';
import { ServiceCatalogItemModel } from './service-catalog-item.model.js';

export class ServiceCatalogRepository {
  async create(workspaceId: string, input: { name: string; unitPrice: number; currency?: string }) {
    const doc = await ServiceCatalogItemModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.name.trim(),
      unitPrice: input.unitPrice,
      currency: input.currency ?? 'BRL',
    });
    return {
      id: doc._id.toString(),
      name: doc.name,
      unitPrice: doc.unitPrice,
      currency: doc.currency,
    };
  }

  async list(workspaceId: string, limit = 200) {
    const docs = await ServiceCatalogItemModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .limit(limit)
      .exec();
    return docs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      unitPrice: d.unitPrice,
      currency: d.currency,
    }));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await ServiceCatalogItemModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc
      ? {
          id: doc._id.toString(),
          name: doc.name,
          unitPrice: doc.unitPrice,
          currency: doc.currency,
        }
      : null;
  }
}
