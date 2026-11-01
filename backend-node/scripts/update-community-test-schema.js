import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { communitySchemas } from '../src/modules/community/community.schema.js';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
const uri = process.env.COMMUNITY_TEST_MONGODB_URI || '';
if (!uri.trim() || name !== 'community_test_schema_20261101' || !name.startsWith('community_test') || name === 'zflix' || name === process.env.MONGODB_DB_NAME) throw new Error('The dedicated community test database is required');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(name);
  for (const collection of ['community_posts', 'community_post_comments']) {
    if (!await db.listCollections({ name: collection }).hasNext()) throw new Error(`Missing collection: ${collection}`);
    if (await db.collection(collection).countDocuments() !== 0) throw new Error(`Refusing to update a nonempty collection: ${collection}`);
  }
  for (const collection of ['community_posts', 'community_post_comments']) {
    const definition = communitySchemas[collection];
    await db.command({ collMod: collection, validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
    await db.collection(collection).createIndexes(definition.indexes);
    console.log(`Updated test validator and indexes: ${collection}`);
  }
} finally { await client.close(); }
