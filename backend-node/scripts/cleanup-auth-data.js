import dotenv from "dotenv";

dotenv.config({ quiet: true });
dotenv.config({
  path: new URL("../../.env", import.meta.url),
  override: false,
  quiet: true,
});

const { cleanupAuthData } = await import("../src/modules/auth/auth-cleanup.js");
const { pool } = await import("../src/core/database/pool.js");

try {
  const result = await cleanupAuthData();
  console.log(JSON.stringify(result));
} catch {
  console.error("Auth cleanup failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
