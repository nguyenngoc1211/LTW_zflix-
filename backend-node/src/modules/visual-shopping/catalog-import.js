import { mongoCollection, nextNumericId } from '../../core/database/mongo.js';

const imageUrlsFor = (record) => {
  const raw = record.image_urls || record.image_url || '';
  const urls = (Array.isArray(raw) ? raw : String(raw).split('|'))
    .map((url) => String(url).trim()).filter(Boolean).slice(0, 5);
  return [...new Set(urls)];
};

// Keep the primary embedding field for existing readers. Additional images
// are separate vectors but remain attached to the same catalog product.
export async function insertCatalogProduct(record, embedding, extraEmbeddings = []) {
  const products = await mongoCollection('visual_products');
  const imageUrls = imageUrlsFor(record);
  const existing = await products.findOne({ name: record.name }, { projection: {
    id: 1, image_url: 1, image_urls: 1, embedding: 1, embedding_variants: 1,
  } });
  if (existing) {
    const hasPrimaryEmbedding = (() => {
      try {
        const value = typeof existing.embedding === 'string'
          ? JSON.parse(existing.embedding) : existing.embedding;
        return Array.isArray(value) && value.length > 0;
      } catch { return false; }
    })();
    const knownUrls = new Set([
      ...(existing.embedding_variants || []).map((item) => item.image_url).filter(Boolean),
      ...(hasPrimaryEmbedding && existing.image_url ? [existing.image_url] : []),
    ]);
    const incoming = extraEmbeddings.length ? extraEmbeddings
      : embedding ? [{ imageUrl: imageUrls[0] || record.image_url, embedding }] : [];
    const maxNewVectors = hasPrimaryEmbedding ? 4 - (existing.embedding_variants?.length || 0) : 5;
    const additions = incoming.filter((item) => item?.imageUrl && item?.embedding
      && !knownUrls.has(item.imageUrl)).slice(0, Math.max(0, maxNewVectors));
    if (!additions.length) return false;
    const set = { updated_at: new Date() };
    const variants = additions;
    if (!hasPrimaryEmbedding) {
      const [primary, ...rest] = additions;
      set.embedding = primary.embedding;
      set.image_url = primary.imageUrl;
      variants.splice(0, variants.length, ...rest);
    }
    await products.updateOne({ id: existing.id }, {
      $addToSet: {
        image_urls: { $each: additions.map((item) => item.imageUrl) },
        embedding_variants: { $each: variants.map((item) => ({
          image_url: item.imageUrl,
          embedding: item.embedding,
        })) },
      },
      $set: set,
    });
    return true;
  }
  const id = await nextNumericId('visual_products');
  const primaryImageUrl = imageUrls[0] || record.image_url || null;
  const variants = extraEmbeddings.filter((item) => item?.imageUrl && item?.embedding
    && item.imageUrl !== primaryImageUrl).slice(0, 4);
  await products.insertOne({
    _id: id, id, name: record.name, description: record.description || null,
    category: record.category || null, color: record.color || null,
    price: Number(record.price) || null, currency: record.currency || 'VND',
    marketplace: record.marketplace || 'catalog', product_url: record.product_url || null,
    affiliate_url: record.affiliate_url || null,
    image_url: primaryImageUrl,
    image_urls: imageUrls,
    availability: 1,
    embedding,
    embedding_variants: variants.map((item) => ({
      image_url: item.imageUrl,
      embedding: item.embedding,
    })),
    embedded_at: new Date(),
  });
  return true;
}

export { imageUrlsFor };
