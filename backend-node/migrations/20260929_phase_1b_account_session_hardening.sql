-- Phase 1B: account and session hardening.
-- Existing sessions keep their current effective lifetime by using expires_at
-- as the initial absolute expiry. This migration never drops or truncates data.

SET @schema_name = DATABASE();

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'users'
      AND column_name = 'failed_login_attempts'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'users'
      AND column_name = 'locked_until'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN locked_until DATETIME NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'users'
      AND column_name = 'status'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN status ENUM(''active'',''disabled'') NOT NULL DEFAULT ''active'''
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'users'
      AND column_name = 'disabled_at'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN disabled_at DATETIME NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'users'
      AND column_name = 'password_changed_at'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'auth_sessions'
      AND column_name = 'absolute_expires_at'
  ),
  'SELECT 1',
  'ALTER TABLE auth_sessions ADD COLUMN absolute_expires_at DATETIME NULL AFTER expires_at'
);
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

UPDATE auth_sessions
SET absolute_expires_at = expires_at
WHERE absolute_expires_at IS NULL;

ALTER TABLE auth_sessions
MODIFY COLUMN absolute_expires_at DATETIME NOT NULL;
