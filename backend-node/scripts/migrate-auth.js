import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });
const { pool } = await import("../src/core/database/pool.js");

const createSessionsTable = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
    user_id int NOT NULL,
    refresh_token_hash char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
    user_agent varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    ip_address varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    expires_at datetime NOT NULL,
    absolute_expires_at datetime DEFAULT NULL,
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

const createPasswordResetTokensTable = `
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id bigint unsigned NOT NULL AUTO_INCREMENT,
    user_id int NOT NULL,
    token_hash char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at datetime NOT NULL,
    used_at datetime DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_password_reset_tokens_hash (token_hash),
    KEY idx_password_reset_tokens_user (user_id),
    KEY idx_password_reset_tokens_expiry (expires_at),
    CONSTRAINT password_reset_tokens_ibfk_1
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const addColumnIfMissing = async (tableName, columnName, definition) => {
  const [columns] = await pool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  if (columns.length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
};

try {
  await addColumnIfMissing("users", "failed_login_attempts", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "locked_until", "DATETIME NULL");
  await addColumnIfMissing(
    "users",
    "status",
    "ENUM('active','disabled') NOT NULL DEFAULT 'active'",
  );
  await addColumnIfMissing("users", "disabled_at", "DATETIME NULL");
  await addColumnIfMissing("users", "password_changed_at", "DATETIME NULL");
  await pool.execute(createSessionsTable);
  await pool.execute(createPasswordResetTokensTable);
  await addColumnIfMissing("auth_sessions", "absolute_expires_at", "DATETIME NULL");
  await pool.execute(
    "UPDATE auth_sessions SET absolute_expires_at = expires_at WHERE absolute_expires_at IS NULL",
  );
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
