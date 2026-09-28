-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: movie_streaming_db
-- ------------------------------------------------------
-- Server version	8.0.44-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `actors`
--

DROP TABLE IF EXISTS `actors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `birth_date` date DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female','other','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_name` (`name`),
  KEY `idx_slug` (`slug`),
  FULLTEXT KEY `ft_actor_search` (`name`,`bio`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `actors`
--

LOCK TABLES `actors` WRITE;
/*!40000 ALTER TABLE `actors` DISABLE KEYS */;
INSERT INTO `actors` VALUES (1,'Tom Hanks','tom-hanks','/actors/tom-hanks.jpg','Diễn viên Mỹ nổi tiếng','1956-07-09','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,'Leonardo DiCaprio','leonardo-dicaprio','/actors/leonardo-dicaprio.jpg','Diễn viên Hollywood','1974-11-11','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,'Meryl Streep','meryl-streep','/actors/meryl-streep.jpg','Nữ diễn viên xuất sắc','1949-06-22','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,'Brad Pitt','brad-pitt','/actors/brad-pitt.jpg','Diễn viên kiêm nhà sản xuất','1963-12-18','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,'Jennifer Lawrence','jennifer-lawrence','/actors/jennifer-lawrence.jpg','Nữ diễn viên trẻ tài năng','1990-08-15','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,'Robert Downey Jr.','robert-downey-jr','/actors/robert-downey-jr.jpg','Người sắt trong MCU','1965-04-04','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,'Scarlett Johansson','scarlett-johansson','/actors/scarlett-johansson.jpg','Black Widow trong MCU','1984-11-22','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,'Johnny Depp','johnny-depp','/actors/johnny-depp.jpg','Thuyền trưởng Jack Sparrow','1963-06-09','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,'Emma Watson','emma-watson','/actors/emma-watson.jpg','Hermione trong Harry Potter','1990-04-15','UK','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,'Dwayne Johnson','dwayne-johnson','/actors/dwayne-johnson.jpg','The Rock, diễn viên thể hình','1972-05-02','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,'Chris Hemsworth','chris-hemsworth','/actors/chris-hemsworth.jpg','Thor trong MCU','1983-08-11','Australia','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,'Angelina Jolie','angelina-jolie','/actors/angelina-jolie.jpg','Diễn viên kiêm đạo diễn','1975-06-04','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,'Will Smith','will-smith','/actors/will-smith.jpg','Diễn viên kiêm rapper','1968-09-25','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,'Keanu Reeves','keanu-reeves','/actors/keanu-reeves.jpg','John Wick series','1964-09-02','Canada','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,'Margot Robbie','margot-robbie','/actors/margot-robbie.jpg','Harley Quinn trong DC','1990-07-02','Australia','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,'Tom Cruise','tom-cruise','/actors/tom-cruise.jpg','Mission Impossible series','1962-07-03','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,'Natalie Portman','natalie-portman','/actors/natalie-portman.jpg','Diễn viên kiêm đạo diễn','1981-06-09','Israel','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,'Chris Evans','chris-evans','/actors/chris-evans.jpg','Captain America trong MCU','1981-06-13','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,'Samuel L. Jackson','samuel-l-jackson','/actors/samuel-l-jackson.jpg','Diễn viên với hơn 100 phim','1948-12-21','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,'Gal Gadot','gal-gadot','/actors/gal-gadot.jpg','Wonder Woman trong DC','1985-04-30','Israel','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,'Daniel Radcliffe','daniel-radcliffe','/actors/daniel-radcliffe.jpg','Harry Potter series','1989-07-23','UK','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,'Emma Stone','emma-stone','/actors/emma-stone.jpg','Diễn viên đoạt giải Oscar','1988-11-06','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,'Ryan Reynolds','ryan-reynolds','/actors/ryan-reynolds.jpg','Deadpool series','1976-10-23','Canada','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,'Anne Hathaway','anne-hathaway','/actors/anne-hathaway.jpg','Diễn viên đoạt giải Oscar','1982-11-12','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,'Matt Damon','matt-damon','/actors/matt-damon.jpg','Jason Bourne series','1970-10-08','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,'Cate Blanchett','cate-blanchett','/actors/cate-blanchett.jpg','Nữ diễn viên đa tài','1969-05-14','Australia','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,'Mark Wahlberg','mark-wahlberg','/actors/mark-wahlberg.jpg','Diễn viên kiêm nhà sản xuất','1971-06-05','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,'Sandra Bullock','sandra-bullock','/actors/sandra-bullock.jpg','Nữ diễn viên thành công','1964-07-26','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,'Hugh Jackman','hugh-jackman','/actors/hugh-jackman.jpg','Wolverine trong X-Men','1968-10-12','Australia','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,'Julia Roberts','julia-roberts','/actors/julia-roberts.jpg','Nữ diễn viên Hollywood','1967-10-28','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,'Vin Diesel','vin-diesel','/actors/vin-diesel.jpg','Fast & Furious series','1967-07-18','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,'Nicole Kidman','nicole-kidman','/actors/nicole-kidman.jpg','Diễn viên đoạt giải Oscar','1967-06-20','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,'Joaquin Phoenix','joaquin-phoenix','/actors/joaquin-phoenix.jpg','Joker trong DC','1974-10-28','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,'Charlize Theron','charlize-theron','/actors/charlize-theron.jpg','Diễn viên Nam Phi','1975-08-07','South Africa','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,'Jason Statham','jason-statham','/actors/jason-statham.jpg','Diễn viên hành động','1967-07-26','UK','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,'Zendaya','zendaya','/actors/zendaya.jpg','Diễn viên trẻ tài năng','1996-09-01','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,'Timothée Chalamet','timothee-chalamet','/actors/timothee-chalamet.jpg','Diễn viên trẻ triển vọng','1995-12-27','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,'Florence Pugh','florence-pugh','/actors/florence-pugh.jpg','Diễn viên trẻ Anh','1996-01-03','UK','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,'Tom Holland','tom-holland','/actors/tom-holland.jpg','Spider-Man trong MCU','1996-06-01','UK','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,'Zoe Saldana','zoe-saldana','/actors/zoe-saldana.jpg','Avatar và Guardians','1978-06-19','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,'Idris Elba','idris-elba','/actors/idris-elba.jpg','Diễn viên người Anh','1972-09-06','UK','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,'Lupita Nyong o','lupita-nyongo','/actors/lupita-nyongo.jpg','Diễn viên đoạt giải Oscar','1983-03-01','Mexico','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,'Michael B. Jordan','michael-b-jordan','/actors/michael-b-jordan.jpg','Black Panther','1987-02-09','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,'Brie Larson','brie-larson','/actors/brie-larson.jpg','Captain Marvel','1989-10-01','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,'Rami Malek','rami-malek','/actors/rami-malek.jpg','Diễn viên đoạt Oscar','1981-05-12','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,'Lady Gaga','lady-gaga','/actors/lady-gaga.jpg','Ca sĩ kiêm diễn viên','1986-03-28','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,'Adam Driver','adam-driver','/actors/adam-driver.jpg','Star Wars sequel trilogy','1983-11-19','USA','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,'Anya Taylor-Joy','anya-taylor-joy','/actors/anya-taylor-joy.jpg','Nữ diễn viên trẻ','1996-04-16','USA','female','2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,'Henry Cavill','henry-cavill','/actors/henry-cavill.jpg','Superman trong DC','1983-05-05','UK','male','2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,'Millie Bobby Brown','millie-bobby-brown','/actors/millie-bobby-brown.jpg','Stranger Things','2004-02-19','Spain','female','2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `actors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookmarks`
--

DROP TABLE IF EXISTS `bookmarks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookmarks` (
  `user_id` int NOT NULL,
  `production_id` int NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `notify_new_episode` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`production_id`),
  KEY `idx_user_bookmarks` (`user_id`,`created_at`),
  KEY `idx_production_bookmarks` (`production_id`),
  CONSTRAINT `bookmarks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bookmarks_ibfk_2` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookmarks`
--

LOCK TABLES `bookmarks` WRITE;
/*!40000 ALTER TABLE `bookmarks` DISABLE KEYS */;
INSERT INTO `bookmarks` VALUES (1,1,'Phim hay nhất về Batman',1,'2026-01-22 00:36:26'),(2,2,'Cần xem lại để hiểu plot',1,'2026-01-22 00:36:26'),(3,3,'Phim Hàn Quốc xuất sắc',1,'2026-01-22 00:36:26'),(4,4,'Hoạt hình hay nhất mọi thời đại',1,'2026-01-22 00:36:26'),(5,5,'Phim kinh điển về mafia',1,'2026-01-22 00:36:26'),(6,6,'Kết thúc hoành tráng cho MCU',1,'2026-01-22 00:36:26'),(7,7,'Tình yêu đẹp trên tàu Titanic',1,'2026-01-22 00:36:26'),(8,8,'Ý tưởng đột phá về thực tại',1,'2026-01-22 00:36:26'),(9,9,'Câu chuyện cảm động về cuộc đời',1,'2026-01-22 00:36:26'),(10,10,'Khoa học viễn tưởng sâu sắc',1,'2026-01-22 00:36:26'),(11,11,'Âm nhạc và tình yêu tuyệt vời',1,'2026-01-22 00:36:26'),(12,12,'Hy vọng và tự do trong tù',1,'2026-01-22 00:36:26'),(13,13,'Phong cách độc đáo của Tarantino',1,'2026-01-22 00:36:26'),(14,14,'Hành động và lịch sử La Mã',1,'2026-01-22 00:36:26'),(15,15,'Khởi đầu của hành trình LOTR',1,'2026-01-22 00:36:26'),(16,16,'Phê phán xã hội tiêu dùng',1,'2026-01-22 00:36:26'),(17,17,'Tâm lý tội phạm kinh điển',1,'2026-01-22 00:36:26'),(18,18,'Du hành thời gian thú vị',1,'2026-01-22 00:36:26'),(19,19,'Tuổi thơ với Simba',1,'2026-01-22 00:36:26'),(20,20,'Khủng long sống lại',1,'2026-01-22 00:36:26'),(21,21,'Series hay nhất Netflix',1,'2026-01-22 00:36:26'),(22,22,'Chính trị và quyền lực đẫm máu',1,'2026-01-22 00:36:26'),(23,23,'Biến đổi từ giáo viên thành ông trùm',1,'2026-01-22 00:36:26'),(24,24,'Lịch sử hoàng gia Anh',1,'2026-01-22 00:36:26'),(25,25,'Phù thủy săn quái vật',1,'2026-01-22 00:36:26'),(26,26,'Vụ cướp táo bạo nhất',1,'2026-01-22 00:36:26'),(27,27,'Vũ trụ Star Wars mở rộng',1,'2026-01-22 00:36:26'),(28,28,'Tình bạn đẹp ở New York',1,'2026-01-22 00:36:26'),(29,29,'Văn phòng hài hước nhất',1,'2026-01-22 00:36:26'),(30,30,'Công nghệ và tương lai đáng sợ',1,'2026-01-22 00:36:26'),(31,31,'Mùa 1 Stranger Things',0,'2026-01-22 00:36:26'),(32,32,'Mùa 2 Stranger Things',0,'2026-01-22 00:36:26'),(33,33,'Mùa 3 Stranger Things',0,'2026-01-22 00:36:26'),(34,34,'Mùa 4 Stranger Things',1,'2026-01-22 00:36:26'),(35,35,'Mùa 1 Game of Thrones',0,'2026-01-22 00:36:26'),(36,36,'Mùa 2 Game of Thrones',0,'2026-01-22 00:36:26'),(37,37,'Mùa 3 Game of Thrones',0,'2026-01-22 00:36:26'),(38,38,'Mùa 1 Breaking Bad',0,'2026-01-22 00:36:26'),(39,39,'Mùa 2 Breaking Bad',0,'2026-01-22 00:36:26'),(40,40,'Mùa 3 Breaking Bad',0,'2026-01-22 00:36:26'),(41,41,'Mùa 1 The Crown',0,'2026-01-22 00:36:26'),(42,42,'Mùa 2 The Crown',0,'2026-01-22 00:36:26'),(43,43,'Mùa 1 The Witcher',1,'2026-01-22 00:36:26'),(44,44,'Mùa 2 The Witcher',1,'2026-01-22 00:36:26'),(45,45,'Mùa 1 Money Heist',0,'2026-01-22 00:36:26'),(46,46,'Mùa 2 Money Heist',0,'2026-01-22 00:36:26'),(47,47,'Mùa 1 The Mandalorian',1,'2026-01-22 00:36:26'),(48,48,'Mùa 2 The Mandalorian',1,'2026-01-22 00:36:26'),(49,49,'Mùa 1 Friends',0,'2026-01-22 00:36:26'),(50,50,'Mùa 2 Friends',0,'2026-01-22 00:36:26');
/*!40000 ALTER TABLE `bookmarks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comment_likes`
--

DROP TABLE IF EXISTS `comment_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comment_likes` (
  `user_id` int NOT NULL,
  `comment_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`comment_id`),
  KEY `idx_comment_likes` (`comment_id`,`created_at`),
  CONSTRAINT `comment_likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comment_likes_ibfk_2` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_likes`
--

LOCK TABLES `comment_likes` WRITE;
/*!40000 ALTER TABLE `comment_likes` DISABLE KEYS */;
INSERT INTO `comment_likes` VALUES (2,1,'2026-01-22 00:36:26'),(3,1,'2026-01-22 00:36:26'),(4,1,'2026-01-22 00:36:26'),(5,3,'2026-01-22 00:36:26'),(6,3,'2026-01-22 00:36:26'),(7,5,'2026-01-22 00:36:26'),(8,5,'2026-01-22 00:36:26'),(9,7,'2026-01-22 00:36:26'),(10,7,'2026-01-22 00:36:26'),(11,9,'2026-01-22 00:36:26'),(12,9,'2026-01-22 00:36:26'),(13,11,'2026-01-22 00:36:26'),(14,11,'2026-01-22 00:36:26'),(15,13,'2026-01-22 00:36:26'),(16,13,'2026-01-22 00:36:26'),(17,15,'2026-01-22 00:36:26'),(18,15,'2026-01-22 00:36:26'),(19,17,'2026-01-22 00:36:26'),(20,17,'2026-01-22 00:36:26'),(21,19,'2026-01-22 00:36:26'),(22,19,'2026-01-22 00:36:26'),(23,21,'2026-01-22 00:36:26'),(24,21,'2026-01-22 00:36:26'),(25,23,'2026-01-22 00:36:26'),(26,23,'2026-01-22 00:36:26'),(27,25,'2026-01-22 00:36:26'),(28,25,'2026-01-22 00:36:26'),(29,27,'2026-01-22 00:36:26'),(30,27,'2026-01-22 00:36:26'),(31,29,'2026-01-22 00:36:26'),(32,29,'2026-01-22 00:36:26'),(33,31,'2026-01-22 00:36:26'),(34,31,'2026-01-22 00:36:26'),(35,33,'2026-01-22 00:36:26'),(36,33,'2026-01-22 00:36:26'),(37,35,'2026-01-22 00:36:26'),(38,35,'2026-01-22 00:36:26'),(39,37,'2026-01-22 00:36:26'),(40,37,'2026-01-22 00:36:26'),(41,39,'2026-01-22 00:36:26'),(42,39,'2026-01-22 00:36:26'),(43,41,'2026-01-22 00:36:26'),(44,41,'2026-01-22 00:36:26'),(45,43,'2026-01-22 00:36:26'),(46,43,'2026-01-22 00:36:26'),(47,45,'2026-01-22 00:36:26'),(48,45,'2026-01-22 00:36:26'),(49,47,'2026-01-22 00:36:26'),(50,47,'2026-01-22 00:36:26');
/*!40000 ALTER TABLE `comment_likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `production_id` int NOT NULL,
  `episode_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int DEFAULT NULL,
  `likes_count` int DEFAULT '0',
  `status` enum('active','hidden','deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_production_comments` (`production_id`,`created_at`),
  KEY `idx_episode_comments` (`episode_id`,`created_at`),
  KEY `idx_user_comments` (`user_id`,`created_at`),
  KEY `idx_parent_comments` (`parent_id`,`created_at`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`episode_id`) REFERENCES `episodes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `comments_ibfk_4` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,1,1,NULL,'Phim này thực sự thay đổi cách nhìn về phim siêu anh hùng!',NULL,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,2,1,NULL,'Heath Ledger xứng đáng Oscar cho vai Joker!',1,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,3,2,NULL,'Ai đã xem Inception hơn 3 lần để hiểu plot giơ tay?',NULL,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,4,2,NULL,'Tôi vẫn không hiết cái totem cuối cùng có ngã không?',3,25,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,5,3,NULL,'Parasite xứng đáng Best Picture! Phim Hàn Quốc đầu tiên!',NULL,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,6,3,NULL,'Biểu tượng của xã hội phân tầng rõ ràng!',5,20,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,7,4,NULL,'Tuổi thơ của tôi gắn liền với Spirited Away!',NULL,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,8,4,NULL,'Studio Ghibli không bao giờ làm tôi thất vọng!',7,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,9,5,NULL,'\"I m gonna make him an offer he can t refuse\" - câu thoại kinh điển!',NULL,55,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,10,5,NULL,'Marlon Brando là ông trùm mafia đỉnh nhất!',9,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,11,6,NULL,'Endgame là kết thúc hoàn hảo cho 10 năm MCU!',NULL,60,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,12,6,NULL,'Cảnh \"Avengers assemble\" khiến tôi rơi nước mắt!',11,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,13,7,NULL,'Titanic vẫn là phim tình cảm hay nhất mọi thời đại!',NULL,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,14,7,NULL,'Celine Dion - My Heart Will Go On là bất hủ!',13,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,15,8,NULL,'The Matrix đã thay đổi điện ảnh hành động mãi mãi!',NULL,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,16,8,NULL,'Neo\'s bullet time vẫn là hiệu ứng đỉnh nhất!',15,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,17,9,NULL,'Forrest Gump dạy tôi về tình yêu và cuộc sống!',NULL,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,18,9,NULL,'\"Life is like a box of chocolates\" - câu nói theo tôi cả đời!',17,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,19,10,NULL,'Interstellar khiến tôi khóc ở cảnh cha con!',NULL,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,20,10,NULL,'Âm nhạc của Hans Zimmer quá xuất sắc!',19,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,21,21,NULL,'Stranger Things mang lại cảm giác hoài niệm thập niên 80!',NULL,55,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,22,21,NULL,'Eleven là nhân vật nữ mạnh mẽ nhất!',21,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,23,22,NULL,'Game of Thrones mùa 8 hơi thất vọng nhưng vẫn là series hay!',NULL,70,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,24,22,NULL,'Tôi vẫn chưa tha thứ cho D&D về season 8!',23,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,25,23,NULL,'Breaking Bad là series hay nhất mọi thời đại, không tranh cãi!',NULL,65,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,26,23,NULL,'Walter White từ giáo viên thành ông trùm - character development đỉnh cao!',25,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,27,24,NULL,'The Crown cho thấy áp lực của hoàng gia!',NULL,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,28,24,NULL,'Claire Foy và Olivia Colman đều xuất sắc vai Nữ hoàng!',27,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,29,25,NULL,'Henry Cavill sinh ra để đóng vai Geralt!',NULL,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,30,25,NULL,'Toss a coin to your Witcher - bài hát bị ám ảnh!',29,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,31,31,21,'Tập 1 mùa 1 Stranger Things đã tạo suspense tuyệt vời!',NULL,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,32,31,21,'Will Byers mất tích ngay tập đầu, shock quá!',31,20,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,33,35,26,'Winter is Coming - câu nói kinh điển của Ned Stark!',NULL,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,34,35,26,'Tập 1 đã giết dire wolf, dự báo cái chết!',33,25,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,35,38,29,'Walter White nấu meth lần đầu trong RV!',NULL,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,36,38,29,'Jesse Pinkman là sidekick hoàn hảo!',35,20,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,37,41,32,'Nữ hoàng Elizabeth trẻ đối mặt với Churchill!',NULL,25,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,38,41,32,'Áp lực của vương miện quá lớn!',37,15,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,39,43,34,'Geralt đánh quái đầu tiên rất ngầu!',NULL,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,40,43,34,'Destiny is a powerful thing!',39,20,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,41,45,36,'Professor giải thích kế hoạch hoàn hảo!',NULL,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,42,45,36,'Tokyo và Rio yêu nhau ngay tập đầu!',41,25,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,43,47,38,'Mandalorian nhận nhiệm vụ đầu tiên!',NULL,30,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,44,47,38,'Baby Yoda xuất hiện cuối tập, dễ thương quá!',43,40,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,45,49,40,'Rachel đến Central Perk trong váy cưới!',NULL,45,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,46,49,40,'How you doin? - Joey Tribbiani!',45,35,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,47,1,1,'Cảnh opening bank robbery rất ấn tượng!',NULL,25,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,48,6,6,'Iron Man hy sinh ở cuối phim, khóc quá!',NULL,50,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,49,28,NULL,'Friends vẫn hài hước sau 20 năm!',NULL,60,'active','2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,50,29,NULL,'Michael Scott là ông sếp tệ nhất nhưng đáng yêu nhất!',NULL,55,'active','2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_stats`
--

DROP TABLE IF EXISTS `daily_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `total_users` int DEFAULT '0',
  `new_users` int DEFAULT '0',
  `active_users` int DEFAULT '0',
  `total_views` int DEFAULT '0',
  `total_watch_time` bigint DEFAULT '0',
  `avg_watch_time` int DEFAULT '0',
  `new_subscriptions` int DEFAULT '0',
  `total_revenue` decimal(15,2) DEFAULT '0.00',
  `top_production_id` int DEFAULT NULL,
  `top_genre_id` int DEFAULT NULL,
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stat_date` (`stat_date`),
  KEY `top_production_id` (`top_production_id`),
  KEY `top_genre_id` (`top_genre_id`),
  KEY `idx_stat_date` (`stat_date` DESC),
  CONSTRAINT `daily_stats_ibfk_1` FOREIGN KEY (`top_production_id`) REFERENCES `productions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `daily_stats_ibfk_2` FOREIGN KEY (`top_genre_id`) REFERENCES `genres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_stats`
--

LOCK TABLES `daily_stats` WRITE;
/*!40000 ALTER TABLE `daily_stats` DISABLE KEYS */;
INSERT INTO `daily_stats` VALUES (1,'2024-01-01',1000,50,800,15000,4320000,5400,25,1725000.00,1,1,'2024-01-01 17:05:00'),(2,'2024-01-02',1050,50,820,15200,4380000,5341,28,1932000.00,2,5,'2024-01-02 17:05:00'),(3,'2024-01-03',1100,50,840,15500,4460000,5309,30,2070000.00,3,17,'2024-01-03 17:05:00'),(4,'2024-01-04',1150,50,860,15800,4550000,5290,32,2208000.00,4,7,'2024-01-04 17:05:00'),(5,'2024-01-05',1200,50,880,16000,4600000,5227,35,2415000.00,5,10,'2024-01-05 17:05:00'),(6,'2024-01-06',1250,50,900,16500,4750000,5277,38,2622000.00,6,1,'2024-01-06 17:05:00'),(7,'2024-01-07',1300,50,920,16800,4830000,5250,40,2760000.00,7,2,'2024-01-07 17:05:00'),(8,'2024-01-08',1350,50,940,17000,4890000,5202,42,2898000.00,8,5,'2024-01-08 17:05:00'),(9,'2024-01-09',1400,50,960,17200,4950000,5156,45,3105000.00,9,17,'2024-01-09 17:05:00'),(10,'2024-01-10',1450,50,980,17500,5040000,5142,48,3312000.00,10,5,'2024-01-10 17:05:00'),(11,'2024-01-11',1500,50,1000,17800,5120000,5120,50,3450000.00,11,20,'2024-01-11 17:05:00'),(12,'2024-01-12',1550,50,1020,18000,5180000,5078,52,3588000.00,12,17,'2024-01-12 17:05:00'),(13,'2024-01-13',1600,50,1040,18200,5230000,5028,55,3795000.00,13,10,'2024-01-13 17:05:00'),(14,'2024-01-14',1650,50,1060,18500,5320000,5018,58,4002000.00,14,1,'2024-01-14 17:05:00'),(15,'2024-01-15',1700,50,1080,18800,5410000,5009,60,4140000.00,15,16,'2024-01-15 17:05:00'),(16,'2024-01-16',1750,50,1100,19000,5470000,4972,62,4278000.00,16,17,'2024-01-16 17:05:00'),(17,'2024-01-17',1800,50,1120,19200,5520000,4928,65,4485000.00,17,4,'2024-01-17 17:05:00'),(18,'2024-01-18',1850,50,1140,19500,5610000,4921,68,4692000.00,18,5,'2024-01-18 17:05:00'),(19,'2024-01-19',1900,50,1160,19800,5690000,4905,70,4830000.00,19,7,'2024-01-19 17:05:00'),(20,'2024-01-20',1950,50,1180,20000,5750000,4872,72,4968000.00,20,5,'2024-01-20 17:05:00'),(21,'2024-01-21',2000,50,1200,20200,5810000,4841,75,5175000.00,21,5,'2024-01-21 17:05:00'),(22,'2024-01-22',2050,50,1220,20500,5900000,4836,78,5382000.00,22,16,'2024-01-22 17:05:00'),(23,'2024-01-23',2100,50,1240,20800,5980000,4822,80,5520000.00,23,10,'2024-01-23 17:05:00'),(24,'2024-01-24',2150,50,1260,21000,6040000,4793,82,5658000.00,24,12,'2024-01-24 17:05:00'),(25,'2024-01-25',2200,50,1280,21200,6100000,4765,85,5865000.00,25,16,'2024-01-25 17:05:00'),(26,'2024-01-26',2250,50,1300,21500,6180000,4753,88,6072000.00,26,10,'2024-01-26 17:05:00'),(27,'2024-01-27',2300,50,1320,21800,6270000,4750,90,6210000.00,27,5,'2024-01-27 17:05:00'),(28,'2024-01-28',2350,50,1340,22000,6330000,4723,92,6348000.00,28,3,'2024-01-28 17:05:00'),(29,'2024-01-29',2400,50,1360,22200,6390000,4698,95,6555000.00,29,20,'2024-01-29 17:05:00'),(30,'2024-01-30',2450,50,1380,22500,6470000,4688,98,6762000.00,30,5,'2024-01-30 17:05:00');
/*!40000 ALTER TABLE `daily_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `episodes`
--

DROP TABLE IF EXISTS `episodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `episodes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `production_id` int NOT NULL,
  `episode_number` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration` int NOT NULL COMMENT 'Độ dài tập (giây)',
  `thumbnail_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intro_start` int DEFAULT '0',
  `intro_end` int DEFAULT '0',
  `preview_enabled` tinyint(1) DEFAULT '1',
  `views_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_production_episode` (`production_id`,`episode_number`),
  KEY `idx_production` (`production_id`),
  KEY `idx_episode_number` (`episode_number`),
  KEY `idx_views` (`views_count`),
  CONSTRAINT `episodes_ibfk_1` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `episodes`
--

LOCK TABLES `episodes` WRITE;
/*!40000 ALTER TABLE `episodes` DISABLE KEYS */;
INSERT INTO `episodes` VALUES (1,1,1,'Full Movie',NULL,9120,'/thumbnails/dark-knight.jpg',90,150,1,5001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,2,1,'Full Movie',NULL,8880,'/thumbnails/inception.jpg',60,120,1,4501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,3,1,'Full Movie',NULL,7980,'/thumbnails/parasite.jpg',45,105,0,4001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,4,1,'Full Movie',NULL,7500,'/thumbnails/spirited-away.jpg',30,90,0,3801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,5,1,'Full Movie',NULL,10500,'/thumbnails/godfather.jpg',120,180,1,3501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,6,1,'Full Movie',NULL,10800,'/thumbnails/endgame.jpg',60,120,1,6001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,7,1,'Full Movie',NULL,11940,'/thumbnails/titanic.jpg',90,150,0,5501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,8,1,'Full Movie',NULL,8160,'/thumbnails/matrix.jpg',45,105,1,4201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,9,1,'Full Movie',NULL,8520,'/thumbnails/forrest-gump.jpg',60,120,0,4801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,10,1,'Full Movie',NULL,10140,'/thumbnails/interstellar.jpg',90,150,1,4701,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,11,1,'Full Movie',NULL,7680,'/thumbnails/la-la-land.jpg',30,90,0,3201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,12,1,'Full Movie',NULL,8520,'/thumbnails/shawshank.jpg',60,120,0,5201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,13,1,'Full Movie',NULL,9240,'/thumbnails/pulp-fiction.jpg',45,105,1,3801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,14,1,'Full Movie',NULL,9300,'/thumbnails/gladiator.jpg',60,120,0,4101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,15,1,'Full Movie',NULL,10680,'/thumbnails/lotr1.jpg',120,180,1,3901,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,16,1,'Full Movie',NULL,8340,'/thumbnails/fight-club.jpg',45,105,1,3601,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,17,1,'Full Movie',NULL,7080,'/thumbnails/silence-lambs.jpg',30,90,0,2901,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,18,1,'Full Movie',NULL,6960,'/thumbnails/back-to-future.jpg',45,105,0,4401,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,19,1,'Full Movie',NULL,5280,'/thumbnails/lion-king.jpg',30,90,0,5101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,20,1,'Full Movie',NULL,7620,'/thumbnails/jurassic-park.jpg',60,120,1,4301,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,31,1,'Chapter One: The Vanishing of Will Byers',NULL,3120,'/thumbnails/st1e1.jpg',60,90,1,2501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,31,2,'Chapter Two: The Weirdo on Maple Street',NULL,3300,'/thumbnails/st1e2.jpg',60,90,1,2301,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,31,3,'Chapter Three: Holly, Jolly',NULL,3180,'/thumbnails/st1e3.jpg',60,90,1,2201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,31,4,'Chapter Four: The Body',NULL,3360,'/thumbnails/st1e4.jpg',60,90,1,2101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,31,5,'Chapter Five: The Flea and the Acrobat',NULL,3240,'/thumbnails/st1e5.jpg',60,90,1,2001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,35,1,'Winter Is Coming',NULL,3720,'/thumbnails/got1e1.jpg',90,150,1,2801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,35,2,'The Kingsroad',NULL,3480,'/thumbnails/got1e2.jpg',90,150,1,2601,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,35,3,'Lord Snow',NULL,3600,'/thumbnails/got1e3.jpg',90,150,1,2501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,38,1,'Pilot',NULL,3480,'/thumbnails/bb1e1.jpg',60,120,1,2201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,38,2,'Cat s in the Bag...',NULL,3360,'/thumbnails/bb1e2.jpg',60,120,1,2101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,38,3,'...And the Bag s in the River',NULL,3420,'/thumbnails/bb1e3.jpg',60,120,1,2001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,41,1,'Wolferton Splash',NULL,3540,'/thumbnails/crown1e1.jpg',90,150,1,1801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,41,2,'Hyde Park Corner',NULL,3600,'/thumbnails/crown1e2.jpg',90,150,1,1701,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,43,1,'The End s Beginning',NULL,3720,'/thumbnails/witcher1e1.jpg',60,120,1,1901,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,43,2,'Four Marks',NULL,3660,'/thumbnails/witcher1e2.jpg',60,120,1,1801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,45,1,'Efectuar lo acordado',NULL,3600,'/thumbnails/mh1e1.jpg',60,120,0,2101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,45,2,'Imprudencias letales',NULL,3540,'/thumbnails/mh1e2.jpg',60,120,0,2001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,47,1,'Chapter 1: The Mandalorian',NULL,2460,'/thumbnails/mando1e1.jpg',60,90,1,2301,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,47,2,'Chapter 2: The Child',NULL,2520,'/thumbnails/mando1e2.jpg',60,90,1,2201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,49,1,'The One Where Monica Gets a Roommate',NULL,1380,'/thumbnails/friends1e1.jpg',30,60,0,3001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,49,2,'The One with the Sonogram at the End',NULL,1320,'/thumbnails/friends1e2.jpg',30,60,0,2901,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,49,3,'The One with the Thumb',NULL,1440,'/thumbnails/friends1e3.jpg',30,60,0,2801,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,32,1,'Chapter One: MADMAX',NULL,3540,'/thumbnails/st2e1.jpg',60,90,1,2101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,32,2,'Chapter Two: Trick or Treat, Freak',NULL,3600,'/thumbnails/st2e2.jpg',60,90,1,2001,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,33,1,'Chapter One: Suzie, Do You Copy?',NULL,3660,'/thumbnails/st3e1.jpg',60,90,1,2201,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,33,2,'Chapter Two: The Mall Rats',NULL,3720,'/thumbnails/st3e2.jpg',60,90,1,2101,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,34,1,'Chapter One: The Hellfire Club',NULL,4560,'/thumbnails/st4e1.jpg',60,90,1,2501,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,34,2,'Chapter Two: Vecna s Curse',NULL,4620,'/thumbnails/st4e2.jpg',60,90,1,2401,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,36,1,'The North Remembers',NULL,3540,'/thumbnails/got2e1.jpg',90,150,1,2401,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,39,1,'Seven Thirty-Seven',NULL,3480,'/thumbnails/bb2e1.jpg',60,120,1,1901,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(51,42,1,'Misadventure',NULL,3600,'/thumbnails/crown2e1.jpg',90,150,1,1600,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(52,44,1,'A Grain of Truth',NULL,3720,'/thumbnails/witcher2e1.jpg',60,120,1,1700,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(53,46,1,'Se acabaron las máscaras',NULL,3540,'/thumbnails/mh2e1.jpg',60,120,0,1900,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(54,48,1,'Chapter 9: The Marshal',NULL,2520,'/thumbnails/mando2e1.jpg',60,90,1,2100,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(55,50,1,'The One with Ross s New Girlfriend',NULL,1380,'/thumbnails/friends2e1.jpg',30,60,0,2700,'2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `episodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `genres`
--

DROP TABLE IF EXISTS `genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `genres`
--

LOCK TABLES `genres` WRITE;
/*!40000 ALTER TABLE `genres` DISABLE KEYS */;
INSERT INTO `genres` VALUES (1,'Hành động','hanh-dong','Phim hành động kịch tính','2026-01-22 00:29:16'),(2,'Tình cảm','tinh-cam','Phim tình cảm lãng mạn','2026-01-22 00:29:16'),(3,'Hài hước','hai-huoc','Phim hài hước giải trí','2026-01-22 00:29:16'),(4,'Kinh dị','kinh-di','Phim kinh dị rùng rợn','2026-01-22 00:29:16'),(5,'Viễn tưởng','vien-tuong','Phim viễn tưởng khoa học','2026-01-22 00:29:16'),(6,'Phiêu lưu','phieu-luu','Phim phiêu lưu mạo hiểm','2026-01-22 00:29:16'),(7,'Hoạt hình','hoat-hinh','Phim hoạt hình cho mọi lứa tuổi','2026-01-22 00:29:16'),(8,'Gia đình','gia-dinh','Phim dành cho gia đình','2026-01-22 00:29:16'),(9,'Âm nhạc','am-nhac','Phim về âm nhạc và ca sĩ','2026-01-22 00:29:16'),(10,'Hình sự','hinh-su','Phim hình sự trinh thám','2026-01-22 00:29:16'),(11,'Chiến tranh','chien-tranh','Phim về chiến tranh','2026-01-22 00:29:16'),(12,'Lịch sử','lich-su','Phim lịch sử','2026-01-22 00:29:16'),(13,'Tài liệu','tai-lieu','Phim tài liệu','2026-01-22 00:29:16'),(14,'Thể thao','the-thao','Phim về thể thao','2026-01-22 00:29:16'),(15,'Siêu anh hùng','sieu-anh-hung','Phim về siêu anh hùng','2026-01-22 00:29:16'),(16,'Fantasy','fantasy','Phim fantasy kỳ ảo','2026-01-22 00:29:16'),(17,'Kịch tính','kich-tinh','Phim kịch tính','2026-01-22 00:29:16'),(18,'Bí ẩn','bi-an','Phim bí ẩn hồi hộp','2026-01-22 00:29:16'),(19,'Khoa học viễn tưởng','khoa-hoc-vien-tuong','Phim khoa học viễn tưởng','2026-01-22 00:29:16'),(20,'Hài kịch','hai-kich','Phim hài kịch','2026-01-22 00:29:16'),(21,'Lãng mạn','lang-man','Phim lãng mạn','2026-01-22 00:29:16'),(22,'Tâm lý','tam-ly','Phim tâm lý','2026-01-22 00:29:16'),(23,'Hồi hộp','hoi-hop','Phim hồi hộp gay cấn','2026-01-22 00:29:16'),(24,'Võ thuật','vo-thuat','Phim võ thuật','2026-01-22 00:29:16'),(25,'Cổ trang','co-trang','Phim cổ trang lịch sử','2026-01-22 00:29:16'),(26,'Hiện đại','hien-dai','Phim hiện đại','2026-01-22 00:29:16'),(27,'Thanh xuân','thanh-xuan','Phim về tuổi thanh xuân','2026-01-22 00:29:16'),(28,'Đời thường','doi-thuong','Phim về đời thường','2026-01-22 00:29:16'),(29,'Trinh thám','trinh-tham','Phim trinh thám','2026-01-22 00:29:16'),(30,'Kinh điển','kinh-dien','Phim kinh điển','2026-01-22 00:29:16'),(31,'Thần thoại','than-thoai','Phim thần thoại','2026-01-22 00:29:16'),(32,'Giả tưởng','gia-tuong','Phim giả tưởng','2026-01-22 00:29:16'),(33,'Học đường','hoc-duong','Phim học đường','2026-01-22 00:29:16'),(34,'Y khoa','y-khoa','Phim về y khoa','2026-01-22 00:29:16'),(35,'Luật pháp','luat-phap','Phim về luật pháp','2026-01-22 00:29:16'),(36,'Kinh doanh','kinh-doanh','Phim về kinh doanh','2026-01-22 00:29:16'),(37,'Âm mưu','am-muu','Phim về âm mưu','2026-01-22 00:29:16'),(38,'Tội phạm','toi-pham','Phim về tội phạm','2026-01-22 00:29:16'),(39,'Thảm họa','tham-hoa','Phim thảm họa','2026-01-22 00:29:16'),(40,'Huyền bí','huyen-bi','Phim huyền bí','2026-01-22 00:29:16'),(41,'Tâm linh','tam-linh','Phim tâm linh','2026-01-22 00:29:16'),(42,'Vượt thời gian','vuot-thoi-gian','Phim vượt thời gian','2026-01-22 00:29:16'),(43,'Hậu tận thế','hau-tan-the','Phim hậu tận thế','2026-01-22 00:29:16'),(44,'Siêu nhiên','sieu-nhien','Phim siêu nhiên','2026-01-22 00:29:16'),(45,'Ma cà rồng','ma-ca-rong','Phim về ma cà rồng','2026-01-22 00:29:16'),(46,'Zombie','zombie','Phim về zombie','2026-01-22 00:29:16'),(47,'Điệp viên','diep-vien','Phim về điệp viên','2026-01-22 00:29:16'),(48,'Cướp biển','cuop-bien','Phim về cướp biển','2026-01-22 00:29:16'),(49,'Không gian','khong-gian','Phim về không gian vũ trụ','2026-01-22 00:29:16'),(50,'Dã sử','da-su','Phim dã sử','2026-01-22 00:29:16');
/*!40000 ALTER TABLE `genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movies`
--

DROP TABLE IF EXISTS `movies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movies` (
  `id` int NOT NULL,
  `duration` int NOT NULL COMMENT 'Thời lượng phim (giây)',
  `preview_duration` int DEFAULT '300' COMMENT 'Số giây cho preview (mặc định 300s = 5p)',
  PRIMARY KEY (`id`),
  KEY `idx_duration` (`duration`),
  CONSTRAINT `movies_ibfk_1` FOREIGN KEY (`id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movies`
--

LOCK TABLES `movies` WRITE;
/*!40000 ALTER TABLE `movies` DISABLE KEYS */;
INSERT INTO `movies` VALUES (1,9120,300),(2,8880,300),(3,7980,300),(4,7500,300),(5,10500,300),(6,10800,300),(7,11940,300),(8,8160,300),(9,8520,300),(10,10140,300),(11,7680,300),(12,8520,300),(13,9240,300),(14,9300,300),(15,10680,300),(16,8340,300),(17,7080,300),(18,6960,300),(19,5280,300),(20,7620,300);
/*!40000 ALTER TABLE `movies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('system','vip','new_episode','reply','like','warning') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` enum('production','episode','comment','transaction','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `redirect_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_notifications` (`user_id`,`is_read`,`created_at` DESC),
  KEY `idx_user_type` (`user_id`,`type`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (51,1,'Chào mừng Admin!','Chào mừng quản trị viên đến với MovieHub!','system','user',1,'/admin/dashboard',1,'2026-01-22 00:40:10',NULL),(52,2,'Đăng ký VIP thành công!','Bạn đã đăng ký gói VIP Basic 1 Tháng thành công!','vip','transaction',1,'/user/subscription',1,'2026-01-22 00:40:10',NULL),(53,3,'Gia hạn VIP thành công!','Gói VIP Pro 6 Tháng của bạn đã được gia hạn tự động!','vip','transaction',2,'/user/subscription',0,'2026-01-22 00:40:10',NULL),(54,4,'Có tập mới!','Stranger Things Season 4 đã có tập mới!','new_episode','episode',34,'/watch/34',0,'2026-01-22 00:40:10',NULL),(55,5,'Ai đó đã trả lời bình luận của bạn!','John Doe đã trả lời bình luận của bạn về The Dark Knight!','reply','comment',2,'/comment/1',0,'2026-01-22 00:40:10',NULL),(56,6,'Ai đó đã thích bình luận của bạn!','3 người đã thích bình luận của bạn về Inception!','like','comment',3,'/comment/3',0,'2026-01-22 00:40:10',NULL),(57,7,'Cảnh báo thanh toán!','Thanh toán gần đây của bạn đã thất bại. Vui lòng kiểm tra!','warning','transaction',6,'/user/billing',1,'2026-01-22 00:40:10',NULL),(58,8,'Có phim mới!','Phim mới \"Dune: Part Two\" đã có trên MovieHub!','system','production',51,'/movie/dune-part-two',0,'2026-01-22 00:40:10',NULL),(59,9,'Nhắc nhở gia hạn VIP!','Gói VIP của bạn sẽ hết hạn trong 3 ngày!','vip','user',9,'/user/subscription',0,'2026-01-22 00:40:10',NULL),(60,10,'Có phim mới trong danh sách yêu thích!','Phim bạn bookmark đã có phiên bản 4K!','system','production',2,'/movie/inception',0,'2026-01-22 00:40:10',NULL),(61,11,'Chào mừng đến với MovieHub!','Cảm ơn bạn đã đăng ký tài khoản!','system','user',11,'/welcome',1,'2026-01-22 00:40:10',NULL),(62,12,'Đề xuất phim cho bạn!','Dựa trên lịch sử xem, chúng tôi đề xuất: Interstellar!','system','production',10,'/movie/interstellar',0,'2026-01-22 00:40:10',NULL),(63,13,'Thông báo hệ thống!','MovieHub sẽ bảo trì vào 2h-4h sáng mai!','system','user',13,'/announcements',1,'2026-01-22 00:40:10',NULL),(64,14,'Cảnh báo bảo mật!','Chúng tôi phát hiện đăng nhập từ thiết bị mới!','warning','user',14,'/user/security',1,'2026-01-22 00:40:10',NULL),(65,15,'Khuyến mãi đặc biệt!','Giảm 50% cho gói VIP 1 năm trong tháng này!','vip','user',15,'/subscription',0,'2026-01-22 00:40:10',NULL),(66,16,'Có phim mới thể loại Hành động!','John Wick: Chapter 4 đã có trên MovieHub!','new_episode','production',52,'/movie/john-wick-4',0,'2026-01-22 00:40:10',NULL),(67,17,'Ai đó đã theo dõi bạn!','Jane Smith đã theo dõi bạn trên MovieHub!','like','user',3,'/user/jane_smith',0,'2026-01-22 00:40:10',NULL),(68,18,'Đánh giá của bạn được nhiều người thích!','15 người đã thích đánh giá của bạn về Parasite!','like','production',3,'/movie/parasite/reviews',0,'2026-01-22 00:40:10',NULL),(69,19,'Nhắc nhở xem phim!','Bạn chưa hoàn thành The Godfather!','system','episode',5,'/continue/5',0,'2026-01-22 00:40:10',NULL),(70,20,'Cập nhật ứng dụng!','Phiên bản mới của MovieHub đã có trên App Store!','system','user',20,'/update',1,'2026-01-22 00:40:10',NULL),(71,21,'Quà tặng sinh nhật!','Chúc mừng sinh nhật! Tặng bạn 7 ngày VIP miễn phí!','vip','user',21,'/user/gifts',0,'2026-01-22 00:40:10',NULL),(72,22,'Thông báo từ diễn đàn!','Bài viết của bạn đã được duyệt!','system','comment',23,'/forum/post/123',0,'2026-01-22 00:40:10',NULL),(73,23,'Cảnh báo vi phạm!','Bình luận của bạn đã bị ẩn do vi phạm quy tắc!','warning','comment',25,'/user/comments',1,'2026-01-22 00:40:10',NULL),(74,24,'Khảo sát người dùng!','Giúp chúng tôi cải thiện bằng khảo sát 2 phút!','system','user',24,'/survey',0,'2026-01-22 00:40:10',NULL),(75,25,'Thông báo sự kiện!','Sự kiện xem phim trực tuyến vào thứ 7 tuần này!','system','production',21,'/events/live-watch',0,'2026-01-22 00:40:10',NULL),(76,26,'Cập nhật chính sách!','Chính sách bảo mật đã được cập nhật!','system','user',26,'/privacy-policy',1,'2026-01-22 00:40:10',NULL),(77,27,'Thông báo từ hỗ trợ!','Yêu cầu hỗ trợ #12345 của bạn đã được giải quyết!','system','user',27,'/support/ticket/12345',0,'2026-01-22 00:40:10',NULL),(78,28,'Khuyến mãi cuối tuần!','Giảm 30% tất cả gói VIP trong 48h!','vip','user',28,'/subscription',0,'2026-01-22 00:40:10',NULL),(79,29,'Cảnh báo thiết bị!','Bạn đã đăng nhập trên 5 thiết bị!','warning','user',29,'/user/devices',1,'2026-01-22 00:40:10',NULL),(80,30,'Thông báo phát trực tiếp!','Phát trực tiếp thảo luận về Game of Thrones lúc 20h!','system','production',22,'/live/got-discussion',0,'2026-01-22 00:40:10',NULL),(81,31,'Nhắc nhở đánh giá!','Bạn chưa đánh giá Stranger Things Season 1!','system','production',31,'/rate/31',0,'2026-01-22 00:40:10',NULL),(82,32,'Thông báo cộng đồng!','Cuộc thi đánh giá phim với giải thưởng lớn!','system','user',32,'/community/contest',0,'2026-01-22 00:40:10',NULL),(83,33,'Cập nhật chất lượng!','The Dark Knight đã có phiên bản 4K HDR!','system','production',1,'/movie/the-dark-knight',0,'2026-01-22 00:40:10',NULL),(84,34,'Thông báo từ bạn bè!','Bạn của bạn đã xem cùng phim với bạn!','like','user',35,'/user/activity',0,'2026-01-22 00:40:10',NULL),(85,35,'Cảnh báo tài khoản!','Tài khoản của bạn có hoạt động bất thường!','warning','user',35,'/user/security',1,'2026-01-22 00:40:10',NULL),(86,36,'Thông báo mùa giải!','Mùa phim Halloween đã bắt đầu!','system','production',4,'/genre/horror',0,'2026-01-22 00:40:10',NULL),(87,37,'Nhắc nhở thanh toán!','Hóa đơn VIP của bạn sắp đến hạn thanh toán!','vip','transaction',37,'/user/billing',0,'2026-01-22 00:40:10',NULL),(88,38,'Thông báo tính năng mới!','Tính năng Watch Party đã có sẵn!','system','user',38,'/watch-party',0,'2026-01-22 00:40:10',NULL),(89,39,'Khuyến mãi đặc biệt!','Mua 1 tặng 1 cho gói VIP trong tuần này!','vip','user',39,'/subscription',0,'2026-01-22 00:40:10',NULL),(90,40,'Cảnh báo bản quyền!','Một số phim có thể không khả dụng tại khu vực của bạn!','warning','production',3,'/help/region-restrictions',1,'2026-01-22 00:40:10',NULL),(91,41,'Thông báo lễ hội!','Chương trình Black Friday với ưu đãi lớn!','system','user',41,'/black-friday',0,'2026-01-22 00:40:10',NULL),(92,42,'Nhắc nhở hồ sơ!','Hoàn thiện hồ sơ để nhận quà tặng!','system','user',42,'/user/profile',0,'2026-01-22 00:40:10',NULL),(93,43,'Thông báo diễn viên!','Diễn viên yêu thích của bạn có phim mới!','system','user',43,'/actor/tom-hanks',0,'2026-01-22 00:40:10',NULL),(94,44,'Cảnh báo chất lượng!','Mạng của bạn chậm, chúng tôi đã giảm chất lượng!','warning','user',44,'/settings/quality',1,'2026-01-22 00:40:10',NULL),(95,45,'Thông báo giới hạn!','Bạn đã xem 10h phim trong ngày hôm nay!','system','user',45,'/user/stats',0,'2026-01-22 00:40:10',NULL),(96,46,'Nhắc nhở danh sách!','Danh sách yêu thích của bạn có phim mới khả dụng!','system','production',1,'/user/bookmarks',0,'2026-01-22 00:40:10',NULL),(97,47,'Thông báo giải thưởng!','Bạn đã đạt huy hiệu \"Movie Buff\"!','like','user',47,'/user/badges',0,'2026-01-22 00:40:10',NULL),(98,48,'Cảnh báo dữ liệu!','Bạn đã sử dụng 80% dung lượng tải xuống!','warning','user',48,'/user/downloads',1,'2026-01-22 00:40:10',NULL),(99,49,'Thông báo sự kiện!','Buổi Q&A với đạo diễn Christopher Nolan!','system','production',2,'/events/nolan-qa',0,'2026-01-22 00:40:10',NULL),(100,50,'Nhắc nhở cộng đồng!','Tham gia group fan Game of Thrones!','system','production',22,'/community/got-fans',0,'2026-01-22 00:40:10',NULL);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_actors`
--

DROP TABLE IF EXISTS `production_actors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_actors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `production_id` int NOT NULL,
  `actor_id` int NOT NULL,
  `character_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `character_slug` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_type` enum('cast','director','writer','producer','crew') COLLATE utf8mb4_unicode_ci DEFAULT 'cast',
  `display_order` int DEFAULT '0',
  `is_main` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_production_actor_role` (`production_id`,`actor_id`,`role_type`),
  KEY `idx_production_cast` (`production_id`,`role_type`,`display_order`),
  KEY `idx_actor_productions` (`actor_id`,`production_id`),
  KEY `idx_character_search` (`character_name`(100)),
  CONSTRAINT `production_actors_ibfk_1` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_actors_ibfk_2` FOREIGN KEY (`actor_id`) REFERENCES `actors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_actors`
--

LOCK TABLES `production_actors` WRITE;
/*!40000 ALTER TABLE `production_actors` DISABLE KEYS */;
INSERT INTO `production_actors` VALUES (1,1,1,'Bruce Wayne / Batman',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,1,2,'Harvey Dent / Two-Face',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,1,3,'Rachel Dawes',NULL,'cast',3,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,1,4,'Alfred Pennyworth',NULL,'cast',4,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,2,2,'Dom Cobb',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,2,5,'Ariadne',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,2,6,'Arthur',NULL,'cast',3,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,2,7,'Mal',NULL,'cast',4,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,3,8,'Kim Ki-taek',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,3,9,'Park Dong-ik',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,21,10,'Eleven',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,21,11,'Mike Wheeler',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,21,12,'Dustin Henderson',NULL,'cast',3,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,22,13,'Jon Snow',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,22,14,'Daenerys Targaryen',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,22,15,'Tyrion Lannister',NULL,'cast',3,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,23,16,'Walter White',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,23,17,'Jesse Pinkman',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,24,18,'Queen Elizabeth II',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,24,19,'Prince Philip',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,25,20,'Geralt of Rivia',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,25,21,'Yennefer of Vengerberg',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,25,22,'Ciri',NULL,'cast',3,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,26,23,'The Professor',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,26,24,'Tokyo',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,27,25,'Din Djarin / The Mandalorian',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,27,26,'The Child / Grogu',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,28,27,'Rachel Green',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,28,28,'Monica Geller',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,28,29,'Chandler Bing',NULL,'cast',3,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,28,30,'Ross Geller',NULL,'cast',4,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,28,31,'Joey Tribbiani',NULL,'cast',5,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,28,32,'Phoebe Buffay',NULL,'cast',6,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,29,33,'Michael Scott',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,29,34,'Dwight Schrute',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,29,35,'Jim Halpert',NULL,'cast',3,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,30,36,'Various Characters',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,30,37,'Various Characters',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,4,38,'Chihiro Ogino',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,5,39,'Vito Corleone',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,6,40,'Tony Stark / Iron Man',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,6,41,'Steve Rogers / Captain America',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,6,42,'Thor',NULL,'cast',3,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,7,43,'Jack Dawson',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,7,44,'Rose DeWitt Bukater',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,8,45,'Neo',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,8,46,'Trinity',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,9,47,'Forrest Gump',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,9,48,'Jenny Curran',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,10,49,'Cooper',NULL,'cast',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(51,10,50,'Brand',NULL,'cast',2,1,'2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `production_actors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_genres`
--

DROP TABLE IF EXISTS `production_genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_genres` (
  `production_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`production_id`,`genre_id`),
  KEY `idx_genre` (`genre_id`),
  CONSTRAINT `production_genres_ibfk_1` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_genres_ibfk_2` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_genres`
--

LOCK TABLES `production_genres` WRITE;
/*!40000 ALTER TABLE `production_genres` DISABLE KEYS */;
INSERT INTO `production_genres` VALUES (1,1),(2,1),(6,1),(25,1),(26,1),(27,1),(7,2),(28,3),(29,3),(2,5),(6,5),(8,5),(10,5),(21,5),(27,5),(30,5),(4,7),(5,10),(23,10),(26,10),(7,11),(24,12),(1,15),(6,15),(4,16),(22,16),(25,16),(3,17),(5,17),(7,17),(9,17),(22,17),(23,17),(24,17),(1,18),(3,18),(21,18),(26,18),(30,18),(2,19),(8,19),(10,19),(28,20),(29,20),(22,25),(24,25),(25,25),(9,26),(28,26),(9,28),(3,31),(5,31),(4,32),(29,35),(23,38),(8,42),(21,42),(30,42),(10,49),(27,49);
/*!40000 ALTER TABLE `production_genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productions`
--

DROP TABLE IF EXISTS `productions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('movie','season','series') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `poster_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ongoing','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'ongoing',
  `release_year` year DEFAULT NULL,
  `is_premium` tinyint(1) DEFAULT '0',
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rating_avg` decimal(3,1) DEFAULT '0.0',
  `rating_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `language` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_type` (`type`),
  KEY `idx_slug` (`slug`),
  KEY `idx_status` (`status`),
  KEY `idx_premium` (`is_premium`),
  KEY `idx_release_year` (`release_year`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productions`
--

LOCK TABLES `productions` WRITE;
/*!40000 ALTER TABLE `productions` DISABLE KEYS */;
INSERT INTO `productions` VALUES (1,'movie','The Dark Knight','the-dark-knight','Phim siêu anh hùng về Batman','/posters/dark-knight.jpg','/banners/dark-knight-banner.jpg','completed',2008,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(2,'movie','Inception','inception','Phim hành động khoa học viễn tưởng','/posters/inception.jpg','/banners/inception-banner.jpg','completed',2010,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(3,'movie','Parasite','parasite','Phim điện ảnh Hàn Quốc đoạt Oscar','/posters/parasite.jpg','/banners/parasite-banner.jpg','completed',2019,0,'South Korea',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','Korean'),(4,'movie','Spirited Away','spirited-away','Phim hoạt hình Nhật Bản của Studio Ghibli','/posters/spirited-away.jpg','/banners/spirited-away-banner.jpg','completed',2001,0,'Japan',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','Japanese'),(5,'movie','The Godfather','the-godfather','Phim tội phạm cổ điển','/posters/godfather.jpg','/banners/godfather-banner.jpg','completed',1972,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(6,'movie','Avengers: Endgame','avengers-endgame','Phim siêu anh hùng Marvel','/posters/endgame.jpg','/banners/endgame-banner.jpg','completed',2019,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(7,'movie','Titanic','titanic','Phim tình cảm lịch sử','/posters/titanic.jpg','/banners/titanic-banner.jpg','completed',1997,0,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(8,'movie','The Matrix','the-matrix','Phim khoa học viễn tưởng','/posters/matrix.jpg','/banners/matrix-banner.jpg','completed',1999,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(9,'movie','Forrest Gump','forrest-gump','Phim chính kịch lịch sử','/posters/forrest-gump.jpg','/banners/forrest-gump-banner.jpg','completed',1994,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(10,'movie','Interstellar','interstellar','Phim khoa học viễn tưởng về không gian','/posters/interstellar.jpg','/banners/interstellar-banner.jpg','completed',2014,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(11,'movie','La La Land','la-la-land','Phim ca nhạc lãng mạn','/posters/la-la-land.jpg','/banners/la-la-land-banner.jpg','completed',2016,0,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(12,'movie','The Shawshank Redemption','shawshank-redemption','Phim tâm lý tội phạm','/posters/shawshank.jpg','/banners/shawshank-banner.jpg','completed',1994,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(13,'movie','Pulp Fiction','pulp-fiction','Phim tội phạm của Quentin Tarantino','/posters/pulp-fiction.jpg','/banners/pulp-fiction-banner.jpg','completed',1994,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(14,'movie','Gladiator','gladiator','Phim lịch sử hành động','/posters/gladiator.jpg','/banners/gladiator-banner.jpg','completed',2000,0,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(15,'movie','The Lord of the Rings: The Fellowship','lotr-fellowship','Phim fantasy đầu tiên của LOTR','/posters/lotr1.jpg','/banners/lotr1-banner.jpg','completed',2001,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(16,'movie','Fight Club','fight-club','Phim tâm lý hành động','/posters/fight-club.jpg','/banners/fight-club-banner.jpg','completed',1999,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(17,'movie','The Silence of the Lambs','silence-lambs','Phim kinh dị tâm lý','/posters/silence-lambs.jpg','/banners/silence-lambs-banner.jpg','completed',1991,0,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(18,'movie','Back to the Future','back-to-the-future','Phim khoa học viễn tưởng hài','/posters/back-to-future.jpg','/banners/back-to-future-banner.jpg','completed',1985,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(19,'movie','The Lion King','lion-king','Phim hoạt hình Disney','/posters/lion-king.jpg','/banners/lion-king-banner.jpg','completed',1994,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(20,'movie','Jurassic Park','jurassic-park','Phim khoa học viễn tưởng về khủng long','/posters/jurassic-park.jpg','/banners/jurassic-park-banner.jpg','completed',1993,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(21,'series','Stranger Things','stranger-things','Series khoa học viễn tưởng','/posters/stranger-things.jpg','/banners/stranger-things-banner.jpg','ongoing',2016,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(22,'series','Game of Thrones','game-of-thrones','Series fantasy chính kịch','/posters/game-of-thrones.jpg','/banners/game-of-thrones-banner.jpg','completed',2011,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(23,'series','Breaking Bad','breaking-bad','Series tội phạm chính kịch','/posters/breaking-bad.jpg','/banners/breaking-bad-banner.jpg','completed',2008,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(24,'series','The Crown','the-crown','Series lịch sử về Nữ hoàng Anh','/posters/the-crown.jpg','/banners/the-crown-banner.jpg','completed',2016,1,'UK',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(25,'series','The Witcher','the-witcher','Series fantasy hành động','/posters/the-witcher.jpg','/banners/the-witcher-banner.jpg','ongoing',2019,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(26,'series','Money Heist','money-heist','Series tội phạm Tây Ban Nha','/posters/money-heist.jpg','/banners/money-heist-banner.jpg','completed',2017,0,'Spain',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','Spanish'),(27,'series','The Mandalorian','the-mandalorian','Series Star Wars','/posters/mandalorian.jpg','/banners/mandalorian-banner.jpg','ongoing',2019,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(28,'series','Friends','friends','Series hài kịch tình huống','/posters/friends.jpg','/banners/friends-banner.jpg','completed',1994,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(29,'series','The Office','the-office','Series hài kịch mockumentary','/posters/the-office.jpg','/banners/the-office-banner.jpg','completed',2005,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(30,'series','Black Mirror','black-mirror','Series khoa học viễn tưởng','/posters/black-mirror.jpg','/banners/black-mirror-banner.jpg','ongoing',2011,1,'UK',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(31,'season','Stranger Things - Season 1','stranger-things-season-1','Mùa đầu tiên của Stranger Things','/posters/st-season1.jpg','/banners/st-season1-banner.jpg','completed',2016,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(32,'season','Stranger Things - Season 2','stranger-things-season-2','Mùa thứ hai của Stranger Things','/posters/st-season2.jpg','/banners/st-season2-banner.jpg','completed',2017,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(33,'season','Stranger Things - Season 3','stranger-things-season-3','Mùa thứ ba của Stranger Things','/posters/st-season3.jpg','/banners/st-season3-banner.jpg','completed',2019,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(34,'season','Stranger Things - Season 4','stranger-things-season-4','Mùa thứ tư của Stranger Things','/posters/st-season4.jpg','/banners/st-season4-banner.jpg','completed',2022,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(35,'season','Game of Thrones - Season 1','game-of-thrones-season-1','Mùa đầu tiên của Game of Thrones','/posters/got-season1.jpg','/banners/got-season1-banner.jpg','completed',2011,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(36,'season','Game of Thrones - Season 2','game-of-thrones-season-2','Mùa thứ hai của Game of Thrones','/posters/got-season2.jpg','/banners/got-season2-banner.jpg','completed',2012,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(37,'season','Game of Thrones - Season 3','game-of-thrones-season-3','Mùa thứ ba của Game of Thrones','/posters/got-season3.jpg','/banners/got-season3-banner.jpg','completed',2013,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(38,'season','Breaking Bad - Season 1','breaking-bad-season-1','Mùa đầu tiên của Breaking Bad','/posters/bb-season1.jpg','/banners/bb-season1-banner.jpg','completed',2008,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(39,'season','Breaking Bad - Season 2','breaking-bad-season-2','Mùa thứ hai của Breaking Bad','/posters/bb-season2.jpg','/banners/bb-season2-banner.jpg','completed',2009,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(40,'season','Breaking Bad - Season 3','breaking-bad-season-3','Mùa thứ ba của Breaking Bad','/posters/bb-season3.jpg','/banners/bb-season3-banner.jpg','completed',2010,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(41,'season','The Crown - Season 1','the-crown-season-1','Mùa đầu tiên của The Crown','/posters/crown-season1.jpg','/banners/crown-season1-banner.jpg','completed',2016,1,'UK',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(42,'season','The Crown - Season 2','the-crown-season-2','Mùa thứ hai của The Crown','/posters/crown-season2.jpg','/banners/crown-season2-banner.jpg','completed',2017,1,'UK',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(43,'season','The Witcher - Season 1','the-witcher-season-1','Mùa đầu tiên của The Witcher','/posters/witcher-season1.jpg','/banners/witcher-season1-banner.jpg','completed',2019,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(44,'season','The Witcher - Season 2','the-witcher-season-2','Mùa thứ hai của The Witcher','/posters/witcher-season2.jpg','/banners/witcher-season2-banner.jpg','completed',2021,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(45,'season','Money Heist - Season 1','money-heist-season-1','Mùa đầu tiên của Money Heist','/posters/mh-season1.jpg','/banners/mh-season1-banner.jpg','completed',2017,0,'Spain',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','Spanish'),(46,'season','Money Heist - Season 2','money-heist-season-2','Mùa thứ hai của Money Heist','/posters/mh-season2.jpg','/banners/mh-season2-banner.jpg','completed',2018,0,'Spain',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','Spanish'),(47,'season','The Mandalorian - Season 1','mandalorian-season-1','Mùa đầu tiên của The Mandalorian','/posters/mando-season1.jpg','/banners/mando-season1-banner.jpg','completed',2019,1,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(48,'season','The Mandalorian - Season 2','mandalorian-season-2','Mùa thứ hai của The Mandalorian','/posters/mando-season2.jpg','/banners/mando-season2-banner.jpg','completed',2020,1,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(49,'season','Friends - Season 1','friends-season-1','Mùa đầu tiên của Friends','/posters/friends-season1.jpg','/banners/friends-season1-banner.jpg','completed',1994,0,'USA',5.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English'),(50,'season','Friends - Season 2','friends-season-2','Mùa thứ hai của Friends','/posters/friends-season2.jpg','/banners/friends-season2-banner.jpg','completed',1995,0,'USA',4.0,1,'2026-01-22 00:36:26','2026-01-22 00:36:26','English');
/*!40000 ALTER TABLE `productions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ratings`
--

DROP TABLE IF EXISTS `ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ratings` (
  `user_id` int NOT NULL,
  `production_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `review_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_content` text COLLATE utf8mb4_unicode_ci,
  `likes_count` int DEFAULT '0',
  `is_edited` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`production_id`),
  KEY `idx_production_rating` (`production_id`,`rating`),
  KEY `idx_user_rating` (`user_id`,`created_at`),
  CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ratings_chk_1` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ratings`
--

LOCK TABLES `ratings` WRITE;
/*!40000 ALTER TABLE `ratings` DISABLE KEYS */;
INSERT INTO `ratings` VALUES (1,1,5,'Kiệt tác điện ảnh','The Dark Knight là phim siêu anh hùng hay nhất mọi thời đại. Diễn xuất của Heath Ledger xuất sắc.',150,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,2,5,'Đỉnh cao của Nolan','Inception làm thay đổi cách làm phim khoa học viễn tưởng. Plot phức tạp nhưng hấp dẫn.',120,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,3,5,'Oscar xứng đáng','Parasite xứng đáng với mọi giải thưởng. Phim phê phán xã hội sâu sắc.',100,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,4,5,'Tuổi thơ tuyệt vời','Spirited Away là báu vật của hoạt hình Nhật Bản. Âm nhạc và hình ảnh tuyệt đẹp.',90,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,5,5,'Không thể vượt qua','The Godfather dạy cách làm phim tội phạm. Diễn xuất của Marlon Brando kinh điển.',130,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,6,4,'Kết thúc hoành tráng','Avengers: Endgame là kết thúc xứng đáng cho 10 năm MCU. Cảm xúc dâng trào.',180,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,7,4,'Tình yêu vĩnh cửu','Titanic vẫn là phim tình cảm hay nhất. Âm nhạc của Celine Dion bất hủ.',160,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,8,5,'Cách mạng điện ảnh','The Matrix thay đổi cách làm phim hành động. Hiệu ứng đột phá năm 1999.',110,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,9,5,'Bài học cuộc sống','Forrest Gump dạy ta về tình yêu và cuộc sống. \"Life is like a box of chocolates\".',140,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,10,5,'Khoa học và tình cảm','Interstellar kết hợp khoa học và tình cảm cha con hoàn hảo. Âm nhạc của Hans Zimmer xuất sắc.',125,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,11,4,'Âm nhạc tuyệt vời','La La Land mang lại cảm xúc về đam mê và tình yêu. Nhạc phim hay nhất năm.',85,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,12,5,'Hy vọng trong tuyệt vọng','The Shawshank Redemption là phim hay nhất mọi thời đại. Thông điệp về hy vọng mạnh mẽ.',190,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,13,4,'Phong cách độc đáo','Pulp Fiction có cấu trúc kể chuyện độc đáo. Đối thoại sắc sảo và hài hước.',95,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,14,4,'Hành động lịch sử','Gladiator mang lại cảm xúc về trả thù và danh dự. \"Are you not entertained?\"',105,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,15,5,'Khởi đầu hoàn hảo','LOTR Fellowship mở đầu hoàn hảo cho trilogy. Thế giới Middle Earth được xây dựng tỉ mỉ.',155,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,16,5,'Phê phán xã hội','Fight Club phê phán xã hội tiêu dùng và vai trò đàn ông. Twist cuối phim kinh điển.',135,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,17,4,'Kinh dị tâm lý','The Silence of the Lambs là phim kinh dị tâm lý hay nhất. Anthony Hopkins đáng sợ.',95,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,18,5,'Du hành thời gian','Back to the Future là phim du hành thời gian hay nhất. Hài hước và sáng tạo.',120,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,19,5,'Tuổi thơ Disney','The Lion King là hoạt hình Disney hay nhất. Bài học về trách nhiệm và gia đình.',145,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,20,4,'Khủng long sống động','Jurassic Park mang khủng long lên màn ảnh. Hiệu ứng đột phá năm 1993.',115,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,21,5,'Nostalgia tuyệt vời','Stranger Things mang lại cảm giác hoài niệm thập niên 80. Nhân vật đáng yêu.',170,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,22,4,'Chính trị và rồng','Game of Thrones có plot phức tạp và nhân vật đa chiều. Mùa cuối hơi thất vọng.',240,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,23,5,'Bi kịch của Walter White','Breaking Bad là series hay nhất mọi thời đại. Character development xuất sắc.',210,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,24,4,'Lịch sử hoàng gia','The Crown tái hiện lịch sử hoàng gia Anh chân thực. Diễn xuất xuất sắc.',110,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,25,4,'Phù thủy đánh quái','The Witcher trung thành với nguyên tác. Henry Cavill hoàn hảo vai Geralt.',140,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,26,5,'Cướp ngân hàng thông minh','Money Heist có kế hoạch cướp thông minh. Nhân vật có chiều sâu.',160,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,27,4,'Star Wars mới mẻ','The Mandalorian mở rộng vũ trụ Star Wars. Baby Yoda dễ thương.',130,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,28,5,'Tình bạn đẹp','Friends vẫn hài hước sau 20 năm. \"We were on a break!\"',290,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,29,5,'Hài văn phòng','The Office là series hài hay nhất. Steve Carell xuất sắc vai Michael Scott.',190,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,30,4,'Tương lai đáng sợ','Black Mirror cảnh báo về tương lai công nghệ. Mỗi tập là một câu chuyện độc lập.',130,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,31,5,'Khởi đầu hoàn hảo','Stranger Things mùa 1 đặt nền móng hoàn hảo. Mystery và suspense tuyệt vời.',85,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,32,4,'Phát triển nhân vật','Mùa 2 phát triển nhân vật tốt hơn. Eleven tìm lại sức mạnh.',75,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,33,5,'Mùa hè nguy hiểm','Mùa 3 có setting mùa hè thú vị. Hành động và kịch tính tăng cao.',80,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,34,5,'Đỉnh cao của series','Mùa 4 là mùa hay nhất. Vecna là villain đáng sợ nhất.',90,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,35,4,'Giới thiệu thế giới','Mùa 1 giới thiệu thế giới Westeros. Ned Stark là tragedy đầu tiên.',115,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,36,4,'Chiến tranh bắt đầu','Mùa 2 mở rộng chiến tranh. Battle of Blackwater hoành tráng.',105,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,37,5,'Bước ngoặt lớn','Mùa 3 có Red Wedding shock nhất. Game of Thrones không an toàn cho nhân vật.',110,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,38,4,'Walter White bắt đầu','Mùa 1 Walter White bước vào thế giới tội phạm. Character development bắt đầu.',95,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,39,5,'Căng thẳng tăng cao','Mùa 2 căng thẳng gia đình Walt. Jesse phát triển nhân vật.',100,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,40,5,'Đối đầu với Gus','Mùa 3 đối đầu với Gus Fring. Kịch tính cao trào.',105,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,41,4,'Nữ hoàng trẻ','Mùa 1 Elizabeth mới lên ngôi. Áp lực của vương miện.',75,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,42,4,'Hôn nhân và chính trị','Mùa 2 tập trung vào hôn nhân hoàng gia. Chính trị quốc tế phức tạp.',80,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,43,4,'Destiny and monsters','Mùa 1 giới thiệu Geralt và destiny. Monster hunting thú vị.',85,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,44,4,'Ciri tập luyện','Mùa 2 Ciri tập luyện tại Kaer Morhen. Family theme mạnh mẽ.',80,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,45,5,'Kế hoạch hoàn hảo','Mùa 1 kế hoạch cướp hoàn hảo. Tokyo và Rio tình cảm.',90,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,46,4,'Đối đầu với cảnh sát','Mùa 2 đối đầu căng thẳng. Professor thông minh hơn cảnh sát.',85,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,47,4,'Lone gunfighter','Mùa 1 Mandalorian đơn độc. Baby Yoda xuất hiện.',80,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,48,5,'Tìm Jedi cho Grogu','Mùa 2 tìm Jedi cho Grogu. Cameo của Luke Skywalker.',85,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,49,5,'Bắt đầu tình bạn','Mùa 1 nhóm bạn gặp nhau. Rachel đến Central Perk.',140,0,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,50,4,'Tình yêu phức tạp','Mùa 2 tình cảm phức tạp. Ross và Rachel break up.',135,0,'2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `ratings` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_rating_insert` AFTER INSERT ON `ratings` FOR EACH ROW CALL UpdateProductionRating(NEW.production_id) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_rating_update` AFTER UPDATE ON `ratings` FOR EACH ROW CALL UpdateProductionRating(NEW.production_id) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_rating_delete` AFTER DELETE ON `ratings` FOR EACH ROW CALL UpdateProductionRating(OLD.production_id) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `seasons`
--

DROP TABLE IF EXISTS `seasons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seasons` (
  `id` int NOT NULL,
  `series_id` int NOT NULL,
  `season_number` int NOT NULL,
  `total_episodes` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_series_season` (`series_id`,`season_number`),
  KEY `idx_series` (`series_id`),
  KEY `idx_season_number` (`season_number`),
  CONSTRAINT `seasons_ibfk_1` FOREIGN KEY (`id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `seasons_ibfk_2` FOREIGN KEY (`series_id`) REFERENCES `series` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seasons`
--

LOCK TABLES `seasons` WRITE;
/*!40000 ALTER TABLE `seasons` DISABLE KEYS */;
INSERT INTO `seasons` VALUES (31,21,1,8),(32,21,2,9),(33,21,3,8),(34,21,4,9),(35,22,1,10),(36,22,2,10),(37,22,3,10),(38,23,1,7),(39,23,2,13),(40,23,3,13),(41,24,1,10),(42,24,2,10),(43,25,1,8),(44,25,2,8),(45,26,1,9),(46,26,2,6),(47,27,1,8),(48,27,2,8),(49,28,1,24),(50,28,2,24);
/*!40000 ALTER TABLE `seasons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `series`
--

DROP TABLE IF EXISTS `series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `series` (
  `id` int NOT NULL,
  `total_seasons` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_total_seasons` (`total_seasons`),
  CONSTRAINT `series_ibfk_1` FOREIGN KEY (`id`) REFERENCES `productions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `series`
--

LOCK TABLES `series` WRITE;
/*!40000 ALTER TABLE `series` DISABLE KEYS */;
INSERT INTO `series` VALUES (25,3),(27,3),(21,4),(23,5),(26,5),(24,6),(30,6),(22,8),(29,9),(28,10);
/*!40000 ALTER TABLE `series` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscription_plans`
--

DROP TABLE IF EXISTS `subscription_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `duration_days` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `discount_price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'VND',
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `display_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_active_display` (`is_active`,`display_order`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_plans`
--

LOCK TABLES `subscription_plans` WRITE;
/*!40000 ALTER TABLE `subscription_plans` DISABLE KEYS */;
INSERT INTO `subscription_plans` VALUES (1,'VIP Basic 1 Tháng','vip_1_month','Gói VIP cơ bản 1 tháng',30,99000.00,69000.00,'VND','{\"4k\": false, \"ad_free\": true, \"devices\": 1, \"download\": 10}',1,1,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,'VIP Pro 6 Tháng','vip_6_month','Gói VIP chuyên nghiệp 6 tháng',180,540000.00,399000.00,'VND','{\"4k\": true, \"ad_free\": true, \"devices\": 3, \"download\": 50, \"early_access\": true}',1,2,'2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,'VIP Premium 1 Năm','vip_1_year','Gói VIP cao cấp 1 năm',365,990000.00,699000.00,'VND','{\"4k\": true, \"ad_free\": true, \"devices\": 5, \"download\": 100, \"early_access\": true, \"offline_view\": true}',1,3,'2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `subscription_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT '0.00',
  `final_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','success','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `payment_method` enum('momo','vnpay','zalopay','credit_card') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_gateway_response` text COLLATE utf8mb4_unicode_ci,
  `vip_start_date` datetime DEFAULT NULL,
  `vip_end_date` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `plan_id` (`plan_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_transaction_code` (`transaction_code`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,'TXN001',2,1,99000.00,30000.00,69000.00,'success','momo',NULL,'2024-01-01 00:00:00','2024-01-31 23:59:59','2024-01-01 03:30:00','2026-01-22 00:36:26'),(2,'TXN002',3,2,540000.00,141000.00,399000.00,'success','vnpay',NULL,'2024-01-02 00:00:00','2024-07-01 23:59:59','2024-01-02 07:20:00','2026-01-22 00:36:26'),(3,'TXN003',4,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-03 00:00:00','2025-01-02 23:59:59','2024-01-03 09:45:00','2026-01-22 00:36:26'),(4,'TXN004',5,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-04 00:00:00','2024-02-03 23:59:59','2024-01-04 04:15:00','2026-01-22 00:36:26'),(5,'TXN005',6,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-05 00:00:00','2024-07-04 23:59:59','2024-01-05 02:30:00','2026-01-22 00:36:26'),(6,'TXN006',7,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-06 00:00:00','2024-02-05 23:59:59','2024-01-06 06:20:00','2026-01-22 00:36:26'),(7,'TXN007',8,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-07 00:00:00','2025-01-06 23:59:59','2024-01-07 08:45:00','2026-01-22 00:36:26'),(8,'TXN008',9,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-08 00:00:00','2024-02-07 23:59:59','2024-01-08 03:30:00','2026-01-22 00:36:26'),(9,'TXN009',10,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-09 00:00:00','2024-07-08 23:59:59','2024-01-09 07:20:00','2026-01-22 00:36:26'),(10,'TXN010',11,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-10 00:00:00','2024-02-09 23:59:59','2024-01-10 09:45:00','2026-01-22 00:36:26'),(11,'TXN011',12,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-11 00:00:00','2025-01-10 23:59:59','2024-01-11 04:15:00','2026-01-22 00:36:26'),(12,'TXN012',13,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-12 00:00:00','2024-02-11 23:59:59','2024-01-12 02:30:00','2026-01-22 00:36:26'),(13,'TXN013',14,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-13 00:00:00','2024-07-12 23:59:59','2024-01-13 06:20:00','2026-01-22 00:36:26'),(14,'TXN014',15,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-14 00:00:00','2024-02-13 23:59:59','2024-01-14 08:45:00','2026-01-22 00:36:26'),(15,'TXN015',16,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-15 00:00:00','2025-01-14 23:59:59','2024-01-15 03:30:00','2026-01-22 00:36:26'),(16,'TXN016',17,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-16 00:00:00','2024-02-15 23:59:59','2024-01-16 07:20:00','2026-01-22 00:36:26'),(17,'TXN017',18,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-17 00:00:00','2024-07-16 23:59:59','2024-01-17 09:45:00','2026-01-22 00:36:26'),(18,'TXN018',19,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-18 00:00:00','2024-02-17 23:59:59','2024-01-18 04:15:00','2026-01-22 00:36:26'),(19,'TXN019',20,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-19 00:00:00','2025-01-18 23:59:59','2024-01-19 02:30:00','2026-01-22 00:36:26'),(20,'TXN020',21,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-20 00:00:00','2024-02-19 23:59:59','2024-01-20 06:20:00','2026-01-22 00:36:26'),(21,'TXN021',22,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-21 00:00:00','2024-07-20 23:59:59','2024-01-21 08:45:00','2026-01-22 00:36:26'),(22,'TXN022',23,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-22 00:00:00','2024-02-21 23:59:59','2024-01-22 03:30:00','2026-01-22 00:36:26'),(23,'TXN023',24,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-23 00:00:00','2025-01-22 23:59:59','2024-01-23 07:20:00','2026-01-22 00:36:26'),(24,'TXN024',25,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-24 00:00:00','2024-02-23 23:59:59','2024-01-24 09:45:00','2026-01-22 00:36:26'),(25,'TXN025',26,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-25 00:00:00','2024-07-24 23:59:59','2024-01-25 04:15:00','2026-01-22 00:36:26'),(26,'TXN026',27,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-26 00:00:00','2024-02-25 23:59:59','2024-01-26 02:30:00','2026-01-22 00:36:26'),(27,'TXN027',28,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-27 00:00:00','2025-01-26 23:59:59','2024-01-27 06:20:00','2026-01-22 00:36:26'),(28,'TXN028',29,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-01-28 00:00:00','2024-02-27 23:59:59','2024-01-28 08:45:00','2026-01-22 00:36:26'),(29,'TXN029',30,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-01-29 00:00:00','2024-07-28 23:59:59','2024-01-29 03:30:00','2026-01-22 00:36:26'),(30,'TXN030',31,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-01-30 00:00:00','2024-02-29 23:59:59','2024-01-30 07:20:00','2026-01-22 00:36:26'),(31,'TXN031',32,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-01-31 00:00:00','2025-01-30 23:59:59','2024-01-31 09:45:00','2026-01-22 00:36:26'),(32,'TXN032',33,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-02-01 00:00:00','2024-03-02 23:59:59','2024-02-01 04:15:00','2026-01-22 00:36:26'),(33,'TXN033',34,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-02-02 00:00:00','2024-08-01 23:59:59','2024-02-02 02:30:00','2026-01-22 00:36:26'),(34,'TXN034',35,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-02-03 00:00:00','2024-03-04 23:59:59','2024-02-03 06:20:00','2026-01-22 00:36:26'),(35,'TXN035',36,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-02-04 00:00:00','2025-02-03 23:59:59','2024-02-04 08:45:00','2026-01-22 00:36:26'),(36,'TXN036',37,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-02-05 00:00:00','2024-03-06 23:59:59','2024-02-05 03:30:00','2026-01-22 00:36:26'),(37,'TXN037',38,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-02-06 00:00:00','2024-08-05 23:59:59','2024-02-06 07:20:00','2026-01-22 00:36:26'),(38,'TXN038',39,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-02-07 00:00:00','2024-03-08 23:59:59','2024-02-07 09:45:00','2026-01-22 00:36:26'),(39,'TXN039',40,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-02-08 00:00:00','2025-02-07 23:59:59','2024-02-08 04:15:00','2026-01-22 00:36:26'),(40,'TXN040',41,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-02-09 00:00:00','2024-03-10 23:59:59','2024-02-09 02:30:00','2026-01-22 00:36:26'),(41,'TXN041',42,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-02-10 00:00:00','2024-08-09 23:59:59','2024-02-10 06:20:00','2026-01-22 00:36:26'),(42,'TXN042',43,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-02-11 00:00:00','2024-03-12 23:59:59','2024-02-11 08:45:00','2026-01-22 00:36:26'),(43,'TXN043',44,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-02-12 00:00:00','2025-02-11 23:59:59','2024-02-12 03:30:00','2026-01-22 00:36:26'),(44,'TXN044',45,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-02-13 00:00:00','2024-03-14 23:59:59','2024-02-13 07:20:00','2026-01-22 00:36:26'),(45,'TXN045',46,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-02-14 00:00:00','2024-08-13 23:59:59','2024-02-14 09:45:00','2026-01-22 00:36:26'),(46,'TXN046',47,1,99000.00,30000.00,69000.00,'success','vnpay',NULL,'2024-02-15 00:00:00','2024-03-16 23:59:59','2024-02-15 04:15:00','2026-01-22 00:36:26'),(47,'TXN047',48,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-02-16 00:00:00','2025-02-15 23:59:59','2024-02-16 02:30:00','2026-01-22 00:36:26'),(48,'TXN048',49,1,99000.00,30000.00,69000.00,'success','zalopay',NULL,'2024-02-17 00:00:00','2024-03-18 23:59:59','2024-02-17 06:20:00','2026-01-22 00:36:26'),(49,'TXN049',50,2,540000.00,141000.00,399000.00,'success','momo',NULL,'2024-02-18 00:00:00','2024-08-17 23:59:59','2024-02-18 08:45:00','2026-01-22 00:36:26'),(50,'TXN050',1,3,990000.00,291000.00,699000.00,'success','credit_card',NULL,'2024-02-19 00:00:00','2025-02-18 23:59:59','2024-02-19 03:30:00','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_subscriptions`
--

DROP TABLE IF EXISTS `user_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `transaction_id` int DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `status` enum('active','expired','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `auto_renew` tinyint(1) DEFAULT '1',
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  KEY `transaction_id` (`transaction_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_end_date` (`end_date`),
  CONSTRAINT `user_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_subscriptions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_subscriptions_ibfk_3` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_subscriptions`
--

LOCK TABLES `user_subscriptions` WRITE;
/*!40000 ALTER TABLE `user_subscriptions` DISABLE KEYS */;
INSERT INTO `user_subscriptions` VALUES (1,2,1,1,'2024-01-01 00:00:00','2024-01-31 23:59:59','expired',1,NULL,'2024-01-01 03:30:00'),(2,3,2,2,'2024-01-02 00:00:00','2024-07-01 23:59:59','active',1,NULL,'2024-01-02 07:20:00'),(3,4,3,3,'2024-01-03 00:00:00','2025-01-02 23:59:59','active',1,NULL,'2024-01-03 09:45:00'),(4,5,1,4,'2024-01-04 00:00:00','2024-02-03 23:59:59','expired',1,NULL,'2024-01-04 04:15:00'),(5,6,2,5,'2024-01-05 00:00:00','2024-07-04 23:59:59','active',1,NULL,'2024-01-05 02:30:00'),(6,7,1,6,'2024-01-06 00:00:00','2024-02-05 23:59:59','expired',1,NULL,'2024-01-06 06:20:00'),(7,8,3,7,'2024-01-07 00:00:00','2025-01-06 23:59:59','active',1,NULL,'2024-01-07 08:45:00'),(8,9,1,8,'2024-01-08 00:00:00','2024-02-07 23:59:59','expired',1,NULL,'2024-01-08 03:30:00'),(9,10,2,9,'2024-01-09 00:00:00','2024-07-08 23:59:59','active',1,NULL,'2024-01-09 07:20:00'),(10,11,1,10,'2024-01-10 00:00:00','2024-02-09 23:59:59','expired',1,NULL,'2024-01-10 09:45:00'),(11,12,3,11,'2024-01-11 00:00:00','2025-01-10 23:59:59','active',1,NULL,'2024-01-11 04:15:00'),(12,13,1,12,'2024-01-12 00:00:00','2024-02-11 23:59:59','expired',1,NULL,'2024-01-12 02:30:00'),(13,14,2,13,'2024-01-13 00:00:00','2024-07-12 23:59:59','active',1,NULL,'2024-01-13 06:20:00'),(14,15,1,14,'2024-01-14 00:00:00','2024-02-13 23:59:59','expired',1,NULL,'2024-01-14 08:45:00'),(15,16,3,15,'2024-01-15 00:00:00','2025-01-14 23:59:59','active',1,NULL,'2024-01-15 03:30:00'),(16,17,1,16,'2024-01-16 00:00:00','2024-02-15 23:59:59','expired',1,NULL,'2024-01-16 07:20:00'),(17,18,2,17,'2024-01-17 00:00:00','2024-07-16 23:59:59','active',1,NULL,'2024-01-17 09:45:00'),(18,19,1,18,'2024-01-18 00:00:00','2024-02-17 23:59:59','expired',1,NULL,'2024-01-18 04:15:00'),(19,20,3,19,'2024-01-19 00:00:00','2025-01-18 23:59:59','active',1,NULL,'2024-01-19 02:30:00'),(20,21,1,20,'2024-01-20 00:00:00','2024-02-19 23:59:59','expired',1,NULL,'2024-01-20 06:20:00'),(21,22,2,21,'2024-01-21 00:00:00','2024-07-20 23:59:59','active',1,NULL,'2024-01-21 08:45:00'),(22,23,1,22,'2024-01-22 00:00:00','2024-02-21 23:59:59','expired',1,NULL,'2024-01-22 03:30:00'),(23,24,3,23,'2024-01-23 00:00:00','2025-01-22 23:59:59','active',1,NULL,'2024-01-23 07:20:00'),(24,25,1,24,'2024-01-24 00:00:00','2024-02-23 23:59:59','expired',1,NULL,'2024-01-24 09:45:00'),(25,26,2,25,'2024-01-25 00:00:00','2024-07-24 23:59:59','active',1,NULL,'2024-01-25 04:15:00'),(26,27,1,26,'2024-01-26 00:00:00','2024-02-25 23:59:59','expired',1,NULL,'2024-01-26 02:30:00'),(27,28,3,27,'2024-01-27 00:00:00','2025-01-26 23:59:59','active',1,NULL,'2024-01-27 06:20:00'),(28,29,1,28,'2024-01-28 00:00:00','2024-02-27 23:59:59','expired',1,NULL,'2024-01-28 08:45:00'),(29,30,2,29,'2024-01-29 00:00:00','2024-07-28 23:59:59','active',1,NULL,'2024-01-29 03:30:00'),(30,31,1,30,'2024-01-30 00:00:00','2024-02-29 23:59:59','expired',1,NULL,'2024-01-30 07:20:00'),(31,32,3,31,'2024-01-31 00:00:00','2025-01-30 23:59:59','active',1,NULL,'2024-01-31 09:45:00'),(32,33,1,32,'2024-02-01 00:00:00','2024-03-02 23:59:59','expired',1,NULL,'2024-02-01 04:15:00'),(33,34,2,33,'2024-02-02 00:00:00','2024-08-01 23:59:59','active',1,NULL,'2024-02-02 02:30:00'),(34,35,1,34,'2024-02-03 00:00:00','2024-03-04 23:59:59','expired',1,NULL,'2024-02-03 06:20:00'),(35,36,3,35,'2024-02-04 00:00:00','2025-02-03 23:59:59','active',1,NULL,'2024-02-04 08:45:00'),(36,37,1,36,'2024-02-05 00:00:00','2024-03-06 23:59:59','expired',1,NULL,'2024-02-05 03:30:00'),(37,38,2,37,'2024-02-06 00:00:00','2024-08-05 23:59:59','active',1,NULL,'2024-02-06 07:20:00'),(38,39,1,38,'2024-02-07 00:00:00','2024-03-08 23:59:59','expired',1,NULL,'2024-02-07 09:45:00'),(39,40,3,39,'2024-02-08 00:00:00','2025-02-07 23:59:59','active',1,NULL,'2024-02-08 04:15:00'),(40,41,1,40,'2024-02-09 00:00:00','2024-03-10 23:59:59','expired',1,NULL,'2024-02-09 02:30:00'),(41,42,2,41,'2024-02-10 00:00:00','2024-08-09 23:59:59','active',1,NULL,'2024-02-10 06:20:00'),(42,43,1,42,'2024-02-11 00:00:00','2024-03-12 23:59:59','expired',1,NULL,'2024-02-11 08:45:00'),(43,44,3,43,'2024-02-12 00:00:00','2025-02-11 23:59:59','active',1,NULL,'2024-02-12 03:30:00'),(44,45,1,44,'2024-02-13 00:00:00','2024-03-14 23:59:59','expired',1,NULL,'2024-02-13 07:20:00'),(45,46,2,45,'2024-02-14 00:00:00','2024-08-13 23:59:59','active',1,NULL,'2024-02-14 09:45:00'),(46,47,1,46,'2024-02-15 00:00:00','2024-03-16 23:59:59','expired',1,NULL,'2024-02-15 04:15:00'),(47,48,3,47,'2024-02-16 00:00:00','2025-02-15 23:59:59','active',1,NULL,'2024-02-16 02:30:00'),(48,49,1,48,'2024-02-17 00:00:00','2024-03-18 23:59:59','expired',1,NULL,'2024-02-17 06:20:00'),(49,50,2,49,'2024-02-18 00:00:00','2024-08-17 23:59:59','active',1,NULL,'2024-02-18 08:45:00'),(50,1,3,50,'2024-02-19 00:00:00','2025-02-18 23:59:59','active',1,NULL,'2024-02-19 03:30:00');
/*!40000 ALTER TABLE `user_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '/default-avatar.png',
  `role` enum('admin','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `vip_expires_at` datetime DEFAULT NULL,
  `auto_renew` tinyint(1) DEFAULT '0',
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'local',
  `provider_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_watch_time` int DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_vip_expires` (`vip_expires_at`),
  KEY `idx_role` (`role`),
  KEY `idx_provider` (`provider`,`provider_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@moviehub.com','abc123','/avatars/admin.jpg','admin','2025-12-31 23:59:59',1,'local',NULL,86400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(2,'john_doe','john.doe@email.com','abc123','/avatars/john.jpg','user','2024-12-31 23:59:59',1,'local',NULL,43200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(3,'jane_smith','jane.smith@email.com','abc123','/avatars/jane.jpg','user','2024-11-30 23:59:59',0,'local',NULL,64800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(4,'michael_brown','michael.b@email.com','abc123','/avatars/michael.jpg','user',NULL,0,'local',NULL,21600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(5,'sarah_jones','sarah.j@email.com','abc123','/avatars/sarah.jpg','user','2024-10-31 23:59:59',1,'local',NULL,72000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(6,'david_wilson','david.w@email.com','abc123','/avatars/david.jpg','user',NULL,0,'google','google_123',36000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(7,'lisa_taylor','lisa.t@email.com','abc123','/avatars/lisa.jpg','user','2025-01-31 23:59:59',1,'local',NULL,50400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(8,'robert_clark','robert.c@email.com','abc123','/avatars/robert.jpg','user',NULL,0,'local',NULL,18000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(9,'emily_martin','emily.m@email.com','abc123','/avatars/emily.jpg','user','2024-09-30 23:59:59',0,'local',NULL,86400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(10,'william_anderson','william.a@email.com','abc123','/avatars/william.jpg','user','2024-12-31 23:59:59',1,'local',NULL,28800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(11,'olivia_thomas','olivia.t@email.com','abc123','/avatars/olivia.jpg','user',NULL,0,'google','google_456',57600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(12,'james_jackson','james.j@email.com','abc123','/avatars/james.jpg','user','2025-02-28 23:59:59',1,'local',NULL,39600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(13,'sophia_white','sophia.w@email.com','abc123','/avatars/sophia.jpg','user',NULL,0,'local',NULL,14400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(14,'benjamin_harris','benjamin.h@email.com','abc123','/avatars/benjamin.jpg','user','2024-08-31 23:59:59',0,'local',NULL,75600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(15,'ava_martinez','ava.m@email.com','abc123','/avatars/ava.jpg','user','2024-12-31 23:59:59',1,'local',NULL,32400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(16,'ethan_robinson','ethan.r@email.com','abc123','/avatars/ethan.jpg','user',NULL,0,'local',NULL,10800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(17,'mia_lee','mia.l@email.com','abc123','/avatars/mia.jpg','user','2025-03-31 23:59:59',1,'local',NULL,61200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(18,'alexander_gonzalez','alexander.g@email.com','abc123','/avatars/alexander.jpg','user',NULL,0,'google','google_789',25200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(19,'charlotte_nelson','charlotte.n@email.com','abc123','/avatars/charlotte.jpg','user','2024-07-31 23:59:59',0,'local',NULL,82800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(20,'daniel_carter','daniel.c@email.com','abc123','/avatars/daniel.jpg','user','2024-12-31 23:59:59',1,'local',NULL,36000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(21,'amelia_moore','amelia.m@email.com','abc123','/avatars/amelia.jpg','user',NULL,0,'local',NULL,12600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(22,'matthew_king','matthew.k@email.com','abc123','/avatars/matthew.jpg','user','2025-04-30 23:59:59',1,'local',NULL,46800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(23,'harper_scott','harper.s@email.com','abc123','/avatars/harper.jpg','user',NULL,0,'local',NULL,19800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(24,'henry_young','henry.y@email.com','abc123','/avatars/henry.jpg','user','2024-06-30 23:59:59',0,'local',NULL,79200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(25,'evelyn_turner','evelyn.t@email.com','abc123','/avatars/evelyn.jpg','user','2024-12-31 23:59:59',1,'local',NULL,39600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(26,'joseph_hall','joseph.h@email.com','abc123','/avatars/joseph.jpg','user',NULL,0,'google','google_101',9000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(27,'abigail_adams','abigail.a@email.com','abc123','/avatars/abigail.jpg','user','2025-05-31 23:59:59',1,'local',NULL,54000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(28,'samuel_baker','samuel.b@email.com','abc123','/avatars/samuel.jpg','user',NULL,0,'local',NULL,16200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(29,'elizabeth_cook','elizabeth.c@email.com','abc123','/avatars/elizabeth.jpg','user','2024-05-31 23:59:59',0,'local',NULL,86400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(30,'andrew_edwards','andrew.e@email.com','abc123','/avatars/andrew.jpg','user','2024-12-31 23:59:59',1,'local',NULL,43200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(31,'scarlett_perez','scarlett.p@email.com','abc123','/avatars/scarlett.jpg','user',NULL,0,'local',NULL,7200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(32,'christopher_collins','christopher.c@email.com','abc123','/avatars/christopher.jpg','user','2025-06-30 23:59:59',1,'local',NULL,50400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(33,'victoria_stewart','victoria.s@email.com','abc123','/avatars/victoria.jpg','user',NULL,0,'local',NULL,23400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(34,'joshua_sanchez','joshua.s@email.com','abc123','/avatars/joshua.jpg','user','2024-04-30 23:59:59',0,'local',NULL,90000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(35,'grace_morris','grace.m@email.com','abc123','/avatars/grace.jpg','user','2024-12-31 23:59:59',1,'local',NULL,46800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(36,'ryan_rogers','ryan.r@email.com','abc123','/avatars/ryan.jpg','user',NULL,0,'google','google_202',5400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(37,'zoey_reed','zoey.r@email.com','abc123','/avatars/zoey.jpg','user','2025-07-31 23:59:59',1,'local',NULL,57600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(38,'nathaniel_campbell','nathaniel.c@email.com','abc123','/avatars/nathaniel.jpg','user',NULL,0,'local',NULL,27000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(39,'hannah_phillips','hannah.p@email.com','abc123','/avatars/hannah.jpg','user','2024-03-31 23:59:59',0,'local',NULL,93600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(40,'jonathan_evans','jonathan.e@email.com','abc123','/avatars/jonathan.jpg','user','2024-12-31 23:59:59',1,'local',NULL,50400,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(41,'lily_rivera','lily.r@email.com','abc123','/avatars/lily.jpg','user',NULL,0,'local',NULL,3600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(42,'isaiah_torres','isaiah.t@email.com','abc123','/avatars/isaiah.jpg','user','2025-08-31 23:59:59',1,'local',NULL,64800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(43,'aria_peterson','aria.p@email.com','abc123','/avatars/aria.jpg','user',NULL,0,'local',NULL,30600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(44,'caleb_gray','caleb.g@email.com','abc123','/avatars/caleb.jpg','user','2024-02-29 23:59:59',0,'local',NULL,97200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(45,'leah_ramirez','leah.r@email.com','abc123','/avatars/leah.jpg','user','2024-12-31 23:59:59',1,'local',NULL,54000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(46,'thomas_james','thomas.j@email.com','abc123','/avatars/thomas.jpg','user',NULL,0,'google','google_303',1800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(47,'addison_watson','addison.w@email.com','abc123','/avatars/addison.jpg','user','2025-09-30 23:59:59',1,'local',NULL,72000,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(48,'elijah_brooks','elijah.b@email.com','abc123','/avatars/elijah.jpg','user',NULL,0,'local',NULL,34200,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(49,'aubrey_kelly','aubrey.k@email.com','abc123','/avatars/aubrey.jpg','user','2024-01-31 23:59:59',0,'local',NULL,100800,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26'),(50,'gabriel_sanders','gabriel.s@email.com','abc123','/avatars/gabriel.jpg','user','2024-12-31 23:59:59',1,'local',NULL,57600,'2026-01-22 07:36:26','2026-01-22 00:36:26','2026-01-22 00:36:26');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `watch_history`
--

DROP TABLE IF EXISTS `watch_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `watch_history` (
  `user_id` int NOT NULL,
  `episode_id` int NOT NULL,
  `last_position` int DEFAULT '0' COMMENT 'Giây cuối cùng đã xem',
  `watched_percent` decimal(5,2) DEFAULT '0.00' COMMENT '% đã xem',
  `watched_duration` int DEFAULT '0' COMMENT 'Tổng số giây đã xem',
  `is_completed` tinyint(1) DEFAULT '0',
  `first_watched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_watched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`episode_id`),
  KEY `idx_user_watched` (`user_id`,`last_watched_at`),
  KEY `idx_episode_watched` (`episode_id`,`last_watched_at`),
  KEY `idx_completed` (`is_completed`),
  CONSTRAINT `watch_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_history_ibfk_2` FOREIGN KEY (`episode_id`) REFERENCES `episodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `watch_history`
--

LOCK TABLES `watch_history` WRITE;
/*!40000 ALTER TABLE `watch_history` DISABLE KEYS */;
INSERT INTO `watch_history` VALUES (1,1,9120,100.00,9120,1,'2024-01-15 13:30:00','2024-01-15 15:30:00'),(2,2,4440,50.00,4440,0,'2024-01-16 12:00:00','2024-01-16 12:50:00'),(3,3,7980,100.00,7980,1,'2024-01-17 14:00:00','2024-01-17 15:33:00'),(4,4,3750,50.00,3750,0,'2024-01-18 11:30:00','2024-01-18 12:15:00'),(5,5,10500,100.00,10500,1,'2024-01-19 13:00:00','2024-01-19 15:45:00'),(6,6,5400,50.00,5400,0,'2024-01-20 12:30:00','2024-01-20 13:30:00'),(7,7,11940,100.00,11940,1,'2024-01-21 14:00:00','2024-01-21 16:59:00'),(8,8,4080,50.00,4080,0,'2024-01-22 13:00:00','2024-01-22 13:48:00'),(9,9,8520,100.00,8520,1,'2024-01-23 12:00:00','2024-01-23 14:22:00'),(10,10,5070,50.00,5070,0,'2024-01-24 11:30:00','2024-01-24 12:45:00'),(11,11,7680,100.00,7680,1,'2024-01-25 13:00:00','2024-01-25 15:08:00'),(12,12,4260,50.00,4260,0,'2024-01-26 12:30:00','2024-01-26 13:21:00'),(13,13,9240,100.00,9240,1,'2024-01-27 14:00:00','2024-01-27 16:34:00'),(14,14,4650,50.00,4650,0,'2024-01-28 13:00:00','2024-01-28 13:38:00'),(15,15,10680,100.00,10680,1,'2024-01-29 12:00:00','2024-01-29 14:58:00'),(16,16,4170,50.00,4170,0,'2024-01-30 11:30:00','2024-01-30 12:20:00'),(17,17,7080,100.00,7080,1,'2024-01-31 13:00:00','2024-01-31 14:58:00'),(18,18,3480,50.00,3480,0,'2024-02-01 12:30:00','2024-02-01 13:08:00'),(19,19,5280,100.00,5280,1,'2024-02-02 14:00:00','2024-02-02 15:28:00'),(20,20,3810,50.00,3810,0,'2024-02-03 13:00:00','2024-02-03 13:44:00'),(21,21,3120,100.00,3120,1,'2024-02-04 12:00:00','2024-02-04 13:02:00'),(22,22,1650,50.00,1650,0,'2024-02-05 11:30:00','2024-02-05 11:58:00'),(23,23,3180,100.00,3180,1,'2024-02-06 13:00:00','2024-02-06 14:03:00'),(24,24,1680,50.00,1680,0,'2024-02-07 12:30:00','2024-02-07 12:58:00'),(25,25,3240,100.00,3240,1,'2024-02-08 14:00:00','2024-02-08 15:04:00'),(26,26,1860,50.00,1860,0,'2024-02-09 13:00:00','2024-02-09 13:31:00'),(27,27,3720,100.00,3720,1,'2024-02-10 12:00:00','2024-02-10 13:12:00'),(28,28,1740,50.00,1740,0,'2024-02-11 11:30:00','2024-02-11 11:59:00'),(29,29,3600,100.00,3600,1,'2024-02-12 13:00:00','2024-02-12 14:00:00'),(30,30,1800,50.00,1800,0,'2024-02-13 12:30:00','2024-02-13 13:00:00'),(31,31,3480,100.00,3480,1,'2024-02-14 14:00:00','2024-02-14 14:58:00'),(32,32,1680,50.00,1680,0,'2024-02-15 13:00:00','2024-02-15 13:28:00'),(33,33,3420,100.00,3420,1,'2024-02-16 12:00:00','2024-02-16 12:57:00'),(34,34,1770,50.00,1770,0,'2024-02-17 11:30:00','2024-02-17 11:59:00'),(35,35,3540,100.00,3540,1,'2024-02-18 13:00:00','2024-02-18 13:59:00'),(36,36,1800,50.00,1800,0,'2024-02-19 12:30:00','2024-02-19 13:00:00'),(37,37,3600,100.00,3600,1,'2024-02-20 14:00:00','2024-02-20 15:00:00'),(38,38,1860,50.00,1860,0,'2024-02-21 13:00:00','2024-02-21 13:31:00'),(39,39,3720,100.00,3720,1,'2024-02-22 12:00:00','2024-02-22 13:12:00'),(40,40,1830,50.00,1830,0,'2024-02-23 11:30:00','2024-02-23 11:59:00'),(41,41,3660,100.00,3660,1,'2024-02-24 13:00:00','2024-02-24 14:01:00'),(42,42,1800,50.00,1800,0,'2024-02-25 12:30:00','2024-02-25 12:59:00'),(43,43,3600,100.00,3600,1,'2024-02-26 14:00:00','2024-02-26 15:00:00'),(44,44,1770,50.00,1770,0,'2024-02-27 13:00:00','2024-02-27 13:28:00'),(45,45,3540,100.00,3540,1,'2024-02-28 12:00:00','2024-02-28 12:59:00'),(46,46,1800,50.00,1800,0,'2024-02-29 11:30:00','2024-02-29 11:59:00'),(47,47,2460,100.00,2460,1,'2024-03-01 13:00:00','2024-03-01 13:41:00'),(48,48,1260,50.00,1260,0,'2024-03-02 12:30:00','2024-03-02 12:51:00'),(49,49,1380,100.00,1380,1,'2024-03-03 14:00:00','2024-03-03 14:23:00'),(50,50,690,50.00,690,0,'2024-03-04 13:00:00','2024-03-04 13:11:00');
/*!40000 ALTER TABLE `watch_history` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_watch_history_insert` AFTER INSERT ON `watch_history` FOR EACH ROW BEGIN
    -- Gọi hàm cộng views
    CALL IncrementEpisodeView(NEW.episode_id);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `watch_parties`
--

DROP TABLE IF EXISTS `watch_parties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `watch_parties` (
  `id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_participants` int DEFAULT '10',
  `production_id` int NOT NULL,
  `episode_id` int NOT NULL,
  `current_position` int DEFAULT '0',
  `is_playing` tinyint(1) DEFAULT '0',
  `allow_chat` tinyint(1) DEFAULT '1',
  `allow_skip_votes` tinyint(1) DEFAULT '0',
  `skip_votes_required` int DEFAULT '3',
  `status` enum('waiting','playing','paused','ended') COLLATE utf8mb4_unicode_ci DEFAULT 'waiting',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `production_id` (`production_id`),
  KEY `episode_id` (`episode_id`),
  KEY `idx_host` (`host_id`),
  KEY `idx_status_expires` (`status`,`expires_at`),
  CONSTRAINT `watch_parties_ibfk_1` FOREIGN KEY (`host_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_parties_ibfk_2` FOREIGN KEY (`production_id`) REFERENCES `productions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_parties_ibfk_3` FOREIGN KEY (`episode_id`) REFERENCES `episodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `watch_parties`
--

LOCK TABLES `watch_parties` WRITE;
/*!40000 ALTER TABLE `watch_parties` DISABLE KEYS */;
INSERT INTO `watch_parties` VALUES ('ABC123',1,'Xem The Dark Knight cùng nhau!',NULL,20,1,1,1800,1,1,1,3,'playing','2026-01-22 00:40:10',NULL,'2026-01-23 00:40:10'),('DEF456',2,'Stranger Things Season 4 Marathon','stranger123',15,34,34,0,0,1,0,3,'waiting','2026-01-22 00:40:10',NULL,'2026-01-23 00:40:10'),('GHI789',3,'Game of Thrones Re-watch',NULL,25,35,26,2400,1,1,1,5,'playing','2026-01-22 00:40:10',NULL,'2026-01-23 00:40:10'),('JKL012',4,'Friends Comedy Night','friends4ever',10,49,40,600,1,1,0,3,'playing','2026-01-22 00:40:10',NULL,'2026-01-23 00:40:10'),('MNO345',5,'Marvel Movie Marathon',NULL,30,6,6,3600,1,1,1,4,'playing','2026-01-22 00:40:10',NULL,'2026-01-23 00:40:10');
/*!40000 ALTER TABLE `watch_parties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `watch_party_chats`
--

DROP TABLE IF EXISTS `watch_party_chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `watch_party_chats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `party_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp_in_video` int DEFAULT '0',
  `is_system_message` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_party_chats` (`party_id`,`created_at`),
  CONSTRAINT `watch_party_chats_ibfk_1` FOREIGN KEY (`party_id`) REFERENCES `watch_parties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_party_chats_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `watch_party_chats`
--

LOCK TABLES `watch_party_chats` WRITE;
/*!40000 ALTER TABLE `watch_party_chats` DISABLE KEYS */;
INSERT INTO `watch_party_chats` VALUES (1,'ABC123',1,'Chào mừng mọi người đến với phòng xem The Dark Knight!',0,1,'2026-01-22 00:40:10'),(2,'ABC123',2,'Hello mọi người!',60,0,'2026-01-22 00:40:10'),(3,'ABC123',3,'Phim này hay quá!',300,0,'2026-01-22 00:40:10'),(4,'ABC123',4,'Heath Ledger đóng Joker xuất sắc!',600,0,'2026-01-22 00:40:10'),(5,'ABC123',5,'Tại sao tôi không gửi tin nhắn được?',900,0,'2026-01-22 00:40:10'),(6,'DEF456',2,'Phòng xem Stranger Things Season 4 đã bắt đầu!',0,1,'2026-01-22 00:40:10'),(7,'DEF456',6,'Ai đã xem mùa này rồi?',120,0,'2026-01-22 00:40:10'),(8,'DEF456',7,'Tôi chưa xem, đừng spoil nhé!',240,0,'2026-01-22 00:40:10'),(9,'DEF456',8,'Vecna đáng sợ quá!',480,0,'2026-01-22 00:40:10'),(10,'GHI789',3,'Chào mừng đến với Game of Thrones re-watch!',0,1,'2026-01-22 00:40:10'),(11,'GHI789',9,'Winter is coming!',300,0,'2026-01-22 00:40:10'),(12,'GHI789',10,'Ned Stark :(',1200,0,'2026-01-22 00:40:10'),(13,'GHI789',11,'Daenerys mới xuất hiện!',1800,0,'2026-01-22 00:40:10'),(14,'GHI789',12,'Tôi bị mute rồi sao?',2400,0,'2026-01-22 00:40:10'),(15,'JKL012',4,'Friends comedy night bắt đầu!',0,1,'2026-01-22 00:40:10'),(16,'JKL012',13,'How you doin?',60,0,'2026-01-22 00:40:10'),(17,'JKL012',14,'We were on a break!',300,0,'2026-01-22 00:40:10'),(18,'JKL012',15,'Pivot!',600,0,'2026-01-22 00:40:10'),(19,'MNO345',5,'Marvel marathon đã bắt đầu!',0,1,'2026-01-22 00:40:10'),(20,'MNO345',16,'I am Iron Man!',1800,0,'2026-01-22 00:40:10'),(21,'MNO345',17,'Avengers assemble!',3600,0,'2026-01-22 00:40:10'),(22,'MNO345',18,'Cap cầm búa Thor!',5400,0,'2026-01-22 00:40:10'),(23,'MNO345',19,'Cảnh này hay quá!',7200,0,'2026-01-22 00:40:10'),(24,'MNO345',20,'Tại sao tôi bị mute?',9000,0,'2026-01-22 00:40:10'),(25,'ABC123',1,'Vote skip intro nào!',90,0,'2026-01-22 00:40:10');
/*!40000 ALTER TABLE `watch_party_chats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `watch_party_participants`
--

DROP TABLE IF EXISTS `watch_party_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `watch_party_participants` (
  `party_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('host','co-host','participant') COLLATE utf8mb4_unicode_ci DEFAULT 'participant',
  `can_control_playback` tinyint(1) DEFAULT '0',
  `can_send_chat` tinyint(1) DEFAULT '1',
  `is_muted` tinyint(1) DEFAULT '0',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_active_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`party_id`,`user_id`),
  KEY `idx_user_parties` (`user_id`,`joined_at`),
  CONSTRAINT `watch_party_participants_ibfk_1` FOREIGN KEY (`party_id`) REFERENCES `watch_parties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_party_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `watch_party_participants`
--

LOCK TABLES `watch_party_participants` WRITE;
/*!40000 ALTER TABLE `watch_party_participants` DISABLE KEYS */;
INSERT INTO `watch_party_participants` VALUES ('ABC123',1,'host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('ABC123',2,'co-host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('ABC123',3,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('ABC123',4,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('ABC123',5,'participant',0,1,1,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('DEF456',2,'host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('DEF456',6,'co-host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('DEF456',7,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('DEF456',8,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('GHI789',3,'host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('GHI789',9,'co-host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('GHI789',10,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('GHI789',11,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('GHI789',12,'participant',0,1,1,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('JKL012',4,'host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('JKL012',13,'co-host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('JKL012',14,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('JKL012',15,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',5,'host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',16,'co-host',1,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',17,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',18,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',19,'participant',0,1,0,'2026-01-22 00:40:10','2026-01-22 00:40:10'),('MNO345',20,'participant',0,1,1,'2026-01-22 00:40:10','2026-01-22 00:40:10');
/*!40000 ALTER TABLE `watch_party_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'movie_streaming_db'
--

--
-- Dumping routines for database 'movie_streaming_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `IncrementEpisodeView` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `IncrementEpisodeView`(IN episodeId INT)
BEGIN
    -- Chỉ cộng thêm 1, cực nhanh, không cần quét bảng watch_history
    UPDATE episodes 
    SET views_count = views_count + 1, updated_at = NOW()
    WHERE id = episodeId;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `UpdateProductionRating` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdateProductionRating`(IN productionId INT)
BEGIN
    DECLARE avg_rating DECIMAL(3,1);
    DECLARE r_count INT;

    SELECT COALESCE(AVG(rating), 0), COALESCE(COUNT(*), 0)
    INTO avg_rating, r_count
    FROM ratings WHERE production_id = productionId;

    UPDATE productions 
    SET rating_avg = avg_rating, rating_count = r_count, updated_at = NOW()
    WHERE id = productionId;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-22  7:47:34
