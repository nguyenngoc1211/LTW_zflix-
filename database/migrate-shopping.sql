-- Shoppable video: sản phẩm được gắn mốc thời gian trong phim (branch Ngoc)
CREATE TABLE IF NOT EXISTS `production_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `production_id` int NOT NULL,
  `episode_id` int DEFAULT NULL,
  `timestamp_start` int NOT NULL DEFAULT 0 COMMENT 'giây',
  `timestamp_end` int NOT NULL DEFAULT 0 COMMENT 'giây',
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopee_keyword` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `click_count` int NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pp_production` (`production_id`),
  KEY `idx_pp_episode` (`episode_id`),
  CONSTRAINT `pp_production_ibfk_1` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ảnh user chụp khi xem phim (bằng chứng đối chiếu / dữ liệu cho AI vision sau này)
CREATE TABLE IF NOT EXISTS `product_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `episode_id` int DEFAULT NULL,
  `position` int NOT NULL DEFAULT 0 COMMENT 'giây tại thời điểm chụp',
  `image_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matched_product_id` int DEFAULT NULL,
  `keyword_used` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ps_user` (`user_id`),
  KEY `idx_ps_episode` (`episode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu để demo (video mẫu oceans.mp4 dài ~8 phút ở mọi tập)
INSERT INTO `production_products` (`production_id`, `episode_id`, `timestamp_start`, `timestamp_end`, `product_name`, `category`, `image_url`, `shopee_keyword`, `note`)
SELECT 1, 1, 10, 120, 'Áo khoác dạ nam kiểu Batman', 'Thời trang', NULL, 'ao khoac da nam den', 'Scene mở đầu phim'
WHERE NOT EXISTS (SELECT 1 FROM production_products WHERE production_id = 1);
INSERT INTO `production_products` (`production_id`, `episode_id`, `timestamp_start`, `timestamp_end`, `product_name`, `category`, `image_url`, `shopee_keyword`, `note`)
SELECT 1, 1, 60, 300, 'Đồng hồ đeo tay nam dây thép', 'Phụ kiện', NULL, 'dong ho deo tay nam day thep khong goc', NULL
WHERE NOT EXISTS (SELECT 1 FROM production_products WHERE production_id = 1 AND product_name LIKE 'Đồng hồ%');
INSERT INTO `production_products` (`production_id`, `episode_id`, `timestamp_start`, `timestamp_end`, `product_name`, `category`, `image_url`, `shopee_keyword`, `note`)
SELECT 3, 3, 0, 180, 'Bộ ấm trà gốm hàn quốc', 'Đồ gia dụng', NULL, 'am tra gom han quoc', 'Phim Parasite'
WHERE NOT EXISTS (SELECT 1 FROM production_products WHERE production_id = 3);
