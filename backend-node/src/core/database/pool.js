import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl =
  process.env.DATABASE_URL ||
  "mysql://root:rootpassword@localhost:3306/movie_streaming_db";

export const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  enableKeepAlive: true,
  timezone: "Z",
});
