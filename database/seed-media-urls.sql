-- Đồng bộ poster/banner thật (link ngoài) cho catalog demo.
-- Nguồn: DB local, thay cho các đường dẫn /posters/... không tồn tại trong repo.
-- Chạy tự động trên volume mới: docker-entrypoint-initdb.d sau init.sql.

UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ36on4ciuFYNMQBYN_c2N8aOOOzCUFPqt1mtW4y7vs8QrS8YKmzZn1GDpV&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ36on4ciuFYNMQBYN_c2N8aOOOzCUFPqt1mtW4y7vs8QrS8YKmzZn1GDpV&s=10' WHERE `id` = 1;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrPMeaIHZML2_B5nsMJN7yYwogqUg5ByoBpK-WzoiY_SgxJAiTi3Gs1uU&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrPMeaIHZML2_B5nsMJN7yYwogqUg5ByoBpK-WzoiY_SgxJAiTi3Gs1uU&s=10' WHERE `id` = 2;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRESGaROA6HlkPDw3Br6LPiYy3avpidNSafDQUJKrB_yHNid3TBOqfFHKT5&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRESGaROA6HlkPDw3Br6LPiYy3avpidNSafDQUJKrB_yHNid3TBOqfFHKT5&s=10' WHERE `id` = 3;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BNTEyNmEwOWUtYzkyOC00ZTQ4LTllZmUtMjk0Y2YwOGUzYjRiXkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BNTEyNmEwOWUtYzkyOC00ZTQ4LTllZmUtMjk0Y2YwOGUzYjRiXkEyXkFqcGc@._V1_.jpg' WHERE `id` = 4;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QwZWQ2NjdhZTE5XkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QwZWQ2NjdhZTE5XkEyXkFqcGc@._V1_.jpg' WHERE `id` = 5;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpIgAQCQ7Dm0PYyIa-mSeiPUXYxp8D-VBWxr3CVJZEZw&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpIgAQCQ7Dm0PYyIa-mSeiPUXYxp8D-VBWxr3CVJZEZw&s=10' WHERE `id` = 6;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BYzYyN2FiZmUtYWYzMy00MzViLWJkZTMtOGY1ZjgzNWMwN2YxXkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BYzYyN2FiZmUtYWYzMy00MzViLWJkZTMtOGY1ZjgzNWMwN2YxXkEyXkFqcGc@._V1_.jpg' WHERE `id` = 7;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyLYNVT9-YDFhJlPng3TEDIb_eVmbAZ2r_ElDOk61KgA&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyLYNVT9-YDFhJlPng3TEDIb_eVmbAZ2r_ElDOk61KgA&s=10' WHERE `id` = 8;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiglU0MEGUsa92BQzrHfNa47ZZ5-ylZomhrk4yq8YJdZyt1dSuZZFxwV-F&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiglU0MEGUsa92BQzrHfNa47ZZ5-ylZomhrk4yq8YJdZyt1dSuZZFxwV-F&s=10' WHERE `id` = 9;
UPDATE `productions` SET `poster_url` = 'https://upload.wikimedia.org/wikipedia/vi/4/46/Interstellar_poster.jpg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original', `banner_url` = 'https://upload.wikimedia.org/wikipedia/vi/4/46/Interstellar_poster.jpg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original' WHERE `id` = 10;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BMDllYjliOTUtMDJjZC00ODIzLWJmNGMtOWI2NzQxMjA2NzdlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BMDllYjliOTUtMDJjZC00ODIzLWJmNGMtOWI2NzQxMjA2NzdlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg' WHERE `id` = 11;
UPDATE `productions` SET `poster_url` = 'https://upload.wikimedia.org/wikipedia/vi/8/81/ShawshankRedemptionMoviePoster.jpg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original', `banner_url` = 'https://upload.wikimedia.org/wikipedia/vi/8/81/ShawshankRedemptionMoviePoster.jpg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original' WHERE `id` = 12;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_0VXWNDC1NzEzon2aRj3ZvLxvU2TKoig5KI-jsTptwsofiw-DxePcnetO&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_0VXWNDC1NzEzon2aRj3ZvLxvU2TKoig5KI-jsTptwsofiw-DxePcnetO&s=10' WHERE `id` = 13;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTbwB5zd0E--gDVGFgc0fys0I56ITel6y2z1L4F6XaNQ&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTbwB5zd0E--gDVGFgc0fys0I56ITel6y2z1L4F6XaNQ&s=10' WHERE `id` = 14;
UPDATE `productions` SET `poster_url` = 'https://resizing.flixster.com/-XZAfHZM39UwaGJIFWKAE8fS0ak=/v3/t/assets/p28828_p_v8_ao.jpg', `banner_url` = 'https://resizing.flixster.com/-XZAfHZM39UwaGJIFWKAE8fS0ak=/v3/t/assets/p28828_p_v8_ao.jpg' WHERE `id` = 15;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BOTgyOGQ1NDItNGU3Ny00MjU3LTg2YWEtNmEyYjBiMjI1Y2M5XkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BOTgyOGQ1NDItNGU3Ny00MjU3LTg2YWEtNmEyYjBiMjI1Y2M5XkEyXkFqcGc@._V1_.jpg' WHERE `id` = 16;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BNDdhOGJhYzctYzYwZC00YmI2LWI0MjctYjg4ODdlMDExYjBlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BNDdhOGJhYzctYzYwZC00YmI2LWI0MjctYjg4ODdlMDExYjBlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg' WHERE `id` = 17;
UPDATE `productions` SET `poster_url` = 'https://resizing.flixster.com/FklqoVrTrVgdjnDiRljCJBS19sg=/ems.cHJkLWVtcy1hc3NldHMvbW92aWVzL2NhODE3ZDdkLTdkMWItNDgzNi05MmI4LWNjODMyOTExNTMxNC5qcGc=', `banner_url` = 'https://resizing.flixster.com/FklqoVrTrVgdjnDiRljCJBS19sg=/ems.cHJkLWVtcy1hc3NldHMvbW92aWVzL2NhODE3ZDdkLTdkMWItNDgzNi05MmI4LWNjODMyOTExNTMxNC5qcGc=' WHERE `id` = 18;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BMjIwMjE1Nzc4NV5BMl5BanBnXkFtZTgwNDg4OTA1NzM@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BMjIwMjE1Nzc4NV5BMl5BanBnXkFtZTgwNDg4OTA1NzM@._V1_.jpg' WHERE `id` = 19;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShgzkYjLC4kmp8rGiBMUezhDrZRUIBhiC0IOZKmCCPfQ&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShgzkYjLC4kmp8rGiBMUezhDrZRUIBhiC0IOZKmCCPfQ&s=10' WHERE `id` = 20;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb3_Iflknd2uHvbojI7FFSDV0bfsi9Q9W0VMNEexptsO0PxNCC6Wxo9Tg&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb3_Iflknd2uHvbojI7FFSDV0bfsi9Q9W0VMNEexptsO0PxNCC6Wxo9Tg&s=10' WHERE `id` = 21;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BNGYxOGJkMjItZjVkZC00OGEzLWExNjktOTZmNGZhZmRlMTk2XkEyXkFqcGc@._V1_QL75_UX190_CR0,0,190,281_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BNGYxOGJkMjItZjVkZC00OGEzLWExNjktOTZmNGZhZmRlMTk2XkEyXkFqcGc@._V1_QL75_UX190_CR0,0,190,281_.jpg' WHERE `id` = 22;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_.jpg' WHERE `id` = 23;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3MF4u7QKNbvGdwuXYq5rk1PxoWd98QD45f09Bo1twmdppU9VfKsyNbnU&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3MF4u7QKNbvGdwuXYq5rk1PxoWd98QD45f09Bo1twmdppU9VfKsyNbnU&s=10' WHERE `id` = 24;
UPDATE `productions` SET `poster_url` = 'https://upload.wikimedia.org/wikipedia/vi/4/44/Thewitchernetflix.jpeg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original', `banner_url` = 'https://upload.wikimedia.org/wikipedia/vi/4/44/Thewitchernetflix.jpeg?utm_source=vi.wikipedia.org&utm_campaign=index&utm_content=original' WHERE `id` = 25;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4pqU-oShcO8eaZA-yWMEOVoSVxHJEcCbOW79eM1S4tg&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4pqU-oShcO8eaZA-yWMEOVoSVxHJEcCbOW79eM1S4tg&s=10' WHERE `id` = 26;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqTnybj8kFhoWXgnRLqoRBrkn4IwKrc5e_1-Xuva9hMx6rAH3htsHwX4E1&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqTnybj8kFhoWXgnRLqoRBrkn4IwKrc5e_1-Xuva9hMx6rAH3htsHwX4E1&s=10' WHERE `id` = 27;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG0Lj35EJIOvSVHJgXFUGZh26PHGzOCfpQWvGBh4HLsCJz02XLEv59i_Dm&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG0Lj35EJIOvSVHJgXFUGZh26PHGzOCfpQWvGBh4HLsCJz02XLEv59i_Dm&s=10' WHERE `id` = 28;
UPDATE `productions` SET `poster_url` = 'https://m.media-amazon.com/images/M/MV5BZjQwYzBlYzUtZjhhOS00ZDQ0LWE0NzAtYTk4MjgzZTNkZWEzXkEyXkFqcGc@._V1_.jpg', `banner_url` = 'https://m.media-amazon.com/images/M/MV5BZjQwYzBlYzUtZjhhOS00ZDQ0LWE0NzAtYTk4MjgzZTNkZWEzXkEyXkFqcGc@._V1_.jpg' WHERE `id` = 29;
UPDATE `productions` SET `poster_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQhrS2QMLVePkgzxrBv1h8obGL2odQuDZfbaRMH3M5aoKWyzlGiSXi9_C9c&s=10', `banner_url` = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQhrS2QMLVePkgzxrBv1h8obGL2odQuDZfbaRMH3M5aoKWyzlGiSXi9_C9c&s=10' WHERE `id` = 30;

-- Season dùng lại artwork của series cha (chưa có poster riêng).
UPDATE `productions` s JOIN `productions` p ON p.`id` = 21
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (31, 32, 33, 34);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 22
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (35, 36, 37);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 23
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (38, 39, 40);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 24
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (41, 42);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 25
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (43, 44);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 26
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (45, 46);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 27
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (47, 48);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 28
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (49, 50);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 29
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (51);
UPDATE `productions` s JOIN `productions` p ON p.`id` = 30
SET s.`poster_url` = p.`poster_url`, s.`banner_url` = p.`banner_url`
WHERE s.`id` IN (52);

-- Thumbnail tập phim dùng lại banner/poster của phim.
-- Các path /thumbnails/... trong init.sql không tồn tại trong repo.
UPDATE `episodes` e
JOIN `productions` p ON p.`id` = e.`production_id`
SET e.`thumbnail_url` = IF(p.`banner_url` LIKE 'http%', p.`banner_url`, p.`poster_url`)
WHERE e.`thumbnail_url` LIKE '/thumbnails/%';
