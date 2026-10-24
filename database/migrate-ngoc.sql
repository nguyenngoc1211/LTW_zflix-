-- Idempotent migration cho hệ quản trị admin (branch Ngoc)
-- Chạy trên database đã tồn tại: mysql -u root -p movie_streaming_db < migrate-ngoc.sql

CREATE TABLE IF NOT EXISTS `security_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int DEFAULT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `factor` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_se_event` (`event`),
  KEY `idx_se_user` (`user_id`),
  KEY `idx_se_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm role moderator cho phân quyền hệ quản trị
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('user','moderator','admin') NOT NULL DEFAULT 'user';
