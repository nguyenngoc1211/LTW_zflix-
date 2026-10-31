import { Decimal128, MongoClient } from "mongodb";

let client;
let connection;

const mongoUri = () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  return uri;
};

const mongoDatabaseName = () => {
  const name = process.env.MONGODB_DB_NAME?.trim();
  if (!name) throw new Error("MONGODB_DB_NAME is required");
  return name;
};

export const connectMongo = async () => {
  if (!connection) {
    client = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 10000 });
    connection = client.connect().then(() => client.db(mongoDatabaseName())).catch(async (error) => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return connection;
};

export const mongoCollection = async (name) => (await connectMongo()).collection(name);

// Keep API responses compatible with the former mysql2 values: decimals were
// strings and the internal MongoDB _id was never exposed by the SQL routes.
export const fromMongo = (value) => {
  if (value instanceof Decimal128) return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(fromMongo);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== "_id")
      .map(([key, item]) => [key, fromMongo(item)]));
  }
  return value;
};

export const closeMongo = async () => {
  if (client) await client.close();
  client = undefined;
  connection = undefined;
};

// The imported MySQL rows retain their numeric IDs. A counter starts above the
// current maximum so new documents cannot collide with those imported IDs.
export const nextNumericId = async (name) => {
  const db = await connectMongo();
  const target = db.collection(name);
  const highest = await target.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
  const counters = db.collection("_id_counters");
  try {
    await counters.updateOne(
      { _id: name },
      { $setOnInsert: { value: Number(highest?.id || 0) } },
      { upsert: true },
    );
  } catch (error) {
    // Concurrent first writes can race to create the same counter document.
    if (error.code !== 11000) throw error;
  }
  const result = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { returnDocument: "after" },
  );
  return result.value;
};

export const withMongoTransaction = async (work) => {
  await connectMongo();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
};
