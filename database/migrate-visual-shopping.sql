-- AI Visual Shopping (branch Ngoc) — Local Catalog + vector search + affiliate tracking
-- Chạy: mysql -u root -p movie_streaming_db < migrate-visual-shopping.sql

-- Catalog sản phẩm thật (do quản trị import, KHÔNG giả dữ liệu sàn)
CREATE TABLE IF NOT EXISTS `visual_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VND',
  `marketplace` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'catalog',
  `product_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `affiliate_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `availability` tinyint(1) NOT NULL DEFAULT 1,
  `embedding` longtext COLLATE utf8mb4_unicode_ci COMMENT 'JSON array CLIP embedding — build lại HNSW khi boot',
  `embedded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vp_category` (`category`),
  KEY `idx_vp_marketplace` (`marketplace`),
  KEY `idx_vp_availability` (`availability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lượt tìm kiếm bằng ảnh (không lưu ảnh lâu dài)
CREATE TABLE IF NOT EXISTS `visual_searches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `movie_id` int DEFAULT NULL,
  `position` int NOT NULL DEFAULT 0,
  `ai_keyword` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `results_count` int NOT NULL DEFAULT 0,
  `crop_ms` int DEFAULT NULL,
  `embed_ms` int DEFAULT NULL,
  `search_ms` int DEFAULT NULL,
  `rank_ms` int DEFAULT NULL,
  `total_ms` int DEFAULT NULL,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'clip',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vs_user` (`user_id`),
  KEY `idx_vs_movie` (`movie_id`),
  KEY `idx_vs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Click affiliate (product + search liên quan + tracking id)
CREATE TABLE IF NOT EXISTS `affiliate_clicks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `search_id` bigint DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `marketplace` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'catalog',
  `tracking_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ac_product` (`product_id`),
  KEY `idx_ac_search` (`search_id`),
  KEY `idx_ac_user` (`user_id`),
  CONSTRAINT `ac_product_fk` FOREIGN KEY (`product_id`) REFERENCES `visual_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
