# 🚀 Hướng dẫn Deploy Zflix

Tài liệu này tóm tắt cách **deploy production** — từ chạy production trên máy riêng đến
đưa lên cloud miễn phí.

## 1. Chuẩn bị chung (bắt buộc)

Backend ở chế độ production yêu cầu (trong `backend-node/.env`):

```bash
NODE_ENV=production
# Sinh bằng: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_ACCESS_SECRET=<chuỗi ngẫu nhiên ≥32 ký tự, không chứa từ khoá demo/test>
# Sinh bằng: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MFA_ENCRYPTION_KEY=<base64 đúng 32 byte>
# Cho phép nhiều origin, phân cách bằng dấu phẩy
FRONTEND_ORIGIN=https://zflix.example.com,https://www.zflix.example.com
DATABASE_URL=mysql://user:pass@host:3306/movie_streaming_db
```

Frontend: đặt `VITE_API_URL=https://api.zflix.example.com` (qua biến môi trường của
platform, KHÔNG hard-code) trước khi build.

Database: nạp `database/init.sql` (30 bảng + dữ liệu mẫu) rồi chạy thêm
`database/migrate-hai.sql` + `database/migrate-ngoc.sql` nếu dùng DB cũ.

## 2. Phương án A — VPS / máy chủ riêng (Docker, khuyên dùng)

Đã có sẵn `docker-compose.yml` production-ready (MySQL 8 + Elasticsearch + backend +
frontend + 2 service Python):

```bash
git clone -b integration https://github.com/nguyenngoc1211/LTW_zflix-.git
cd LTW_zflix-
cp .env.example .env    # điền JWT_ACCESS_SECRET, MFA_ENCRYPTION_KEY, FRONTEND_ORIGIN
docker compose up -d --build
```

Trỏ domain về server, đặt reverse proxy (Nginx/Caddy) TLS cho `:3000` (API) và `:5173` (web).

## 3. Phương án B — Serverless miễn phí (không cần thẻ tín dụng)

| Thành phần | Gợi ý platform | Ghi chú |
| --- | --- | --- |
| **Frontend** | **Vercel** hoặc Netlify | Import repo, Root Directory `frontend/`, build `npm run build`, output `dist`. Set env `VITE_API_URL`. SPA fallback tự có |
| **Backend** | **Render** (Web Service) hoặc Railway | Root `backend-node/`, start `npm start`. Set toàn bộ env ở mục 1. Render có free tier (sleep khi idle) |
| **MySQL** | **Railway** / Aiven / PlanetScale | Lấy connection string điền vào `DATABASE_URL`, import `init.sql` qua console |
| **Elasticsearch** | *(bỏ qua)* | Không bắt buộc — search tự fallback MySQL LIKE |

Lưu ý khi tách frontend/backend 2 domain: cookie refresh là httpOnly same-site — cần
đặt `FRONTEND_ORIGIN` đúng domain frontend và serve API qua HTTPS.

## 4. Kiểm tra sau deploy

```bash
curl https://api.<domain>/                     # {"message":"Zflix API","status":"ok"}
curl https://api.<domain>/api/v1/filters       # trả danh sách thể loại
# Mở web: đăng ký tài khoản, xem phim, vào /admin-login bằng tài khoản admin
```

Đặt lại mật khẩu admin lần đầu (DB mẫu không kèm plaintext):

```bash
node -e "console.log(require('bcryptjs').hashSync('MậtKhẩuMới',12))"   # copy hash
mysql ... -e "UPDATE users SET password='<hash>' WHERE email='admin@moviehub.com'"
```

## 5. Chạy production trên máy local (đã kiểm chứng)

```bash
# Backend production
cd backend-node && cp .env.example .env   # điền đủ env production ở mục 1
npm ci && npm start                       # http://localhost:3000

# Frontend production
cd frontend && npm ci && npm run build && npx vite preview --port 4173
# FRONTEND_ORIGIN thêm http://localhost:4173 nếu muốn test song song với dev 5173
```

Đã xác minh: build production + SPA fallback (refresh `/login`, `/admin/movies` OK),
đăng nhập admin, dashboard, banner trang chủ, 0 lỗi API.
