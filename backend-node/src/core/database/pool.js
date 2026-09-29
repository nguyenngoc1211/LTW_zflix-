import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  enableKeepAlive: true,
  timezone: "Z",
});
