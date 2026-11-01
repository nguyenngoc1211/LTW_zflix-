import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { communitySchemas } from '../src/modules/community/community.schema.js';

// Explicit test-only opt-in: never run this against the configured application DB.
const name = process.env.COMMUNITY_TEST_DB_NAME || '';
const uri = process.env.COMMUNITY_TEST_MONGODB_URI || '';
if (!uri || !/^community_test_[a-z0-9_]+$/i.test(name) || name === process.env.MONGODB_DB_NAME) {
  throw new Error('Set COMMUNITY_TEST_MONGODB_URI and a separate COMMUNITY_TEST_DB_NAME matching community_test_<suffix>');
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(name);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  // Refuse to alter existing collections, including validators and indexes.
  const conflicts = Object.keys(communitySchemas).filter((collection) => existing.has(collection));
  if (conflicts.length) throw new Error(`Collections already exist: ${conflicts.join(', ')}`);
  for (const [collection, definition] of Object.entries(communitySchemas)) {
    const created = await db.createCollection(collection, { validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
    await created.createIndexes(definition.indexes);
    console.log(`Created ${collection}`);
  }
} finally {
  await client.close();
}
