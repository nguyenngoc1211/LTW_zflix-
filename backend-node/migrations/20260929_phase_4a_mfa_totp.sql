-- Phase 4A: encrypted TOTP MFA, one-time login challenges, and recovery codes.
-- Raw TOTP secrets, challenge tokens, and recovery codes are never persisted.

SET @schema_name = DATABASE();

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_enabled'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_secret_ciphertext'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_secret_ciphertext VARBINARY(255) NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_secret_iv'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_secret_iv BINARY(12) NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_secret_tag'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_secret_tag BINARY(16) NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_enabled_at'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_enabled_at DATETIME NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
         WHERE table_schema = @schema_name AND table_name = 'users' AND column_name = 'mfa_last_used_step'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN mfa_last_used_step BIGINT UNSIGNED NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  token_hash char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  attempts smallint unsigned NOT NULL DEFAULT 0,
  max_attempts smallint unsigned NOT NULL,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_mfa_challenges_hash (token_hash),
  KEY idx_auth_mfa_challenges_user (user_id),
  KEY idx_auth_mfa_challenges_expiry (expires_at, used_at),
  CONSTRAINT auth_mfa_challenges_ibfk_1
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_mfa_recovery_codes (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  code_hash char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_mfa_recovery_codes_hash (code_hash),
  KEY idx_auth_mfa_recovery_codes_user (user_id, used_at),
  CONSTRAINT auth_mfa_recovery_codes_ibfk_1
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
