import { mongoCollection, nextNumericId } from '../../core/database/mongo.js';

// Keep the same numeric IDs and fields used by the MongoDB catalog routes.
export async function insertCatalogProduct(record, embedding) {
  const products = await mongoCollection('visual_products');
  if (await products.findOne({ name: record.name }, { projection: { _id: 1 } })) return false;
  const id = await nextNumericId('visual_products');
  await products.insertOne({
    _id: id, id, name: record.name, description: record.description || null,
    category: record.category || null, color: record.color || null,
    price: Number(record.price) || null, currency: record.currency || 'VND',
    marketplace: record.marketplace || 'catalog', product_url: record.product_url || null,
    affiliate_url: record.affiliate_url || null, image_url: record.image_url,
    availability: 1, embedding, embedded_at: new Date(),
  });
  return true;
}
