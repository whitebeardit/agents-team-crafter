import { Types } from 'mongoose';
import { PackageProductModel } from './package-product.model.js';

export class PackageProductRepository {
  async upsert(
    workspaceId: string,
    input: { slug: string; displayName: string; units: number; priceCents?: number },
  ) {
    const slug = input.slug.trim().toLowerCase();
    const doc = await PackageProductModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), slug },
      {
        $set: {
          displayName: input.displayName.trim(),
          units: input.units,
          ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
    if (!doc) throw new Error('package_catalog_upsert falhou');
    return this.pub(doc);
  }

  async findBySlug(workspaceId: string, slug: string) {
    const doc = await PackageProductModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      slug: slug.trim().toLowerCase(),
    }).exec();
    return doc ? this.pub(doc) : null;
  }

  async listByWorkspace(workspaceId: string) {
    const docs = await PackageProductModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ slug: 1 })
      .exec();
    return docs.map((d) => this.pub(d));
  }

  private pub(doc: {
    _id: Types.ObjectId;
    slug: string;
    displayName: string;
    units: number;
    priceCents?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      slug: doc.slug,
      displayName: doc.displayName,
      units: doc.units,
      priceCents: doc.priceCents,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
