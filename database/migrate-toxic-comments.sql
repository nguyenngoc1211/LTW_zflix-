-- Idempotent migration for databases created before toxic content filtering.
SET @comments_table = 'comments';
SET @toxic_column = 'is_toxic';
SET @add_toxic_column = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `comments` ADD COLUMN `is_toxic` tinyint(1) NOT NULL DEFAULT 0 AFTER `status`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = @comments_table
    AND COLUMN_NAME = @toxic_column
);
PREPARE add_toxic_column_statement FROM @add_toxic_column;
EXECUTE add_toxic_column_statement;
DEALLOCATE PREPARE add_toxic_column_statement;

SET @ratings_table = 'ratings';
SET @add_rating_toxic_column = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `ratings` ADD COLUMN `is_toxic` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_edited`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = @ratings_table
    AND COLUMN_NAME = @toxic_column
);
PREPARE add_rating_toxic_column_statement FROM @add_rating_toxic_column;
EXECUTE add_rating_toxic_column_statement;
DEALLOCATE PREPARE add_rating_toxic_column_statement;
