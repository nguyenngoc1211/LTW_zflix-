import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
if (!process.env.COMMUNITY_TEST_MONGODB_URI?.trim() || name !== 'community_test_schema_20261101' || !name.startsWith('community_test') || name === 'zflix' || name === process.env.MONGODB_DB_NAME) throw new Error('The dedicated community test database is required');
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = name;
process.env.DATA_STORE = 'mongodb';
const { mongoCollection, closeMongo } = await import('../src/core/database/mongo.js');
const { insertCatalogProduct } = await import('../src/modules/visual-shopping/catalog-import.js');
const productName = `test-catalog-${randomUUID()}`;
let inserted = false;
try {
  const products = await mongoCollection('visual_products');
  const record = { name: productName, image_url: 'https://example.invalid/test.png', price: '123' };
  inserted = await insertCatalogProduct(record, [0.2, 0.4]);
  assert.equal(inserted, true);
  assert.equal(await insertCatalogProduct(record, [0.2, 0.4]), false);
  const result = await products.findOne({ name: productName });
  assert.ok(Number.isSafeInteger(result.id));
  assert.equal(result.price, 123);
  assert.deepEqual(result.embedding, [0.2, 0.4]);
  assert.equal(await products.countDocuments({ name: productName }), 1);
  console.log('MongoDB catalog insert and duplicate handling verified');
} finally {
  if (inserted) await (await mongoCollection('visual_products')).deleteOne({ name: productName });
  await closeMongo();
}
