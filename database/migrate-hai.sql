-- Idempotent migration for an existing Zflix database volume.
CREATE TABLE IF NOT EXISTS `production_interests` (
  `user_id` int NOT NULL,
  `production_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`production_id`),
  KEY `idx_interest_production` (`production_id`),
  CONSTRAINT `production_interests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_interests_ibfk_2` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
