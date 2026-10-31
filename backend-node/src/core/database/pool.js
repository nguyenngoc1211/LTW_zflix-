import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.DATA_STORE !== "mongodb") {
  throw new Error("DATABASE_URL is required");
}

export const pool = databaseUrl ? mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  enableKeepAlive: true,
  timezone: "Z",
}) : null;
