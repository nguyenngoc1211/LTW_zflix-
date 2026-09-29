import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/core/database/pool.js";

const createSessionsTable = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
    user_id int NOT NULL,
    refresh_token_hash char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
    user_agent varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    ip_address varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    expires_at datetime NOT NULL,
    last_used_at datetime DEFAULT NULL,
    revoked_at datetime DEFAULT NULL,
    created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_sessions_refresh_hash (refresh_token_hash),
    KEY idx_auth_sessions_user (user_id),
    KEY idx_auth_sessions_expiry (expires_at, revoked_at),
    CONSTRAINT auth_sessions_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

try {
  await pool.execute(createSessionsTable);
  await pool.execute("UPDATE users SET password = NULL WHERE provider <> 'local'");

  const [users] = await pool.execute(
    "SELECT id, password FROM users WHERE provider = 'local' AND password IS NOT NULL",
  );
  let migratedPasswords = 0;
  for (const user of users) {
    if (!/^\$2[aby]\$\d{2}\$/.test(user.password)) {
      const passwordHash = await bcrypt.hash(user.password, 12);
      await pool.execute("UPDATE users SET password = ? WHERE id = ?", [passwordHash, user.id]);
      migratedPasswords += 1;
    }
  }

  console.log(`Auth migration complete; hashed ${migratedPasswords} legacy password(s).`);
} finally {
  await pool.end();
}
