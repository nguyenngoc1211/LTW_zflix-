-- Đồng bộ mật khẩu admin demo với README (admin@moviehub.com / Zflix@2026).
-- Chỉ chạy trên volume mới: docker-entrypoint-initdb.d thực thi sau init.sql.
UPDATE `users`
SET `password` = '$2b$12$8KG6exOxeCdWhQRlILq/V.gA91lwCFuw/6xercYswedfX43RGaYcm'
WHERE `email` = 'admin@moviehub.com';
