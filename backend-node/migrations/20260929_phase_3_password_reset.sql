-- Phase 3: one-time password reset tokens.
-- Raw tokens are never persisted; token_hash stores SHA-256 output only.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
