# 🎬 Zflix — Nền tảng xem phim trực tuyến

Zflix là website xem phim xây dựng theo kiến trúc **Modular Monorepo**, được tích hợp từ công
việc của nhiều thành viên trên các nhánh Git khác nhau (`dev`, `Du`, `Hai`, `Khoa`) về nhánh
`integration`.

## ✨ Chức năng

| Module | Nguồn gốc | Chức năng |
| --- | --- | --- |
| **Discovery** | nhánh `Hai` | Trang chủ, tìm kiếm phim (Elasticsearch + fallback MySQL), lọc theo thể loại/quốc gia/năm/rating, trang chi tiết phim & danh sách tập |
| **Auth & Security** | nhánh `Du` | Đăng ký, đăng nhập (JWT access token + refresh cookie httpOnly), đăng xuất, MFA/TOTP, quên/đặt lại mật khẩu, quản lý phiên đăng nhập, khóa tài khoản khi brute-force, rate limiting, security logging |
| **Community** | nhánh `Hai` | Yêu thích (bookmarks), quan tâm phim mới, đánh giá 1–5 sao, bình luận, thông báo |
| **Streaming** | nhánh `Hai` | Lịch sử xem, lưu/tiếp tục vị trí xem, trình phát video |
| **Watch Party** | nhánh `Khoa` | Xem phim cùng nhau real-time (Socket.IO): đồng bộ play/pause/nhảy thời gian, chat trong phòng, quản lý thành viên (mute/kick/promote), phòng có mật khẩu |
| **Admin** | nhánh `Du`/`Hai` | Khung trang quản trị + API `POST /search/reindex`, `POST /productions/:id/episodes` (yêu cầu role `admin`) |
| **AI / Video services** | nhánh `dev` | Hai service Python (FastAPI) dạng stub — chỉ có health-check, dành cho mở rộng sau |

## 🏗️ Kiến trúc

```
frontend/            React 19 + Vite + Tailwind CSS 4 + Ant Design + react-router 7
backend-node/        Express 5 (ESM) + mysql2 + Socket.IO + helmet + JWT
backend-python/      FastAPI (ai-chatbot :8002, video-processor :8001) — stub
database/            init.sql (schema + seed 50 phim) + migrate-hai.sql (idempotent)
docker-compose.yml   MySQL 8 + Elasticsearch 8 + backend + 2 service Python + frontend
```

- Backend gồm các module độc lập: `auth`, `discovery`, `community`, `streaming`, `watch-party`.
- `business-auth.bridge.js` là cầu nối: các module nghiệp vụ dùng chung middleware xác thực
  của module `auth` (đăng nhập bằng JWT; khi chưa đăng nhập API riêng tư trả 401).
- Tìm kiếm dùng Elasticsearch nếu khả dụng, tự động fallback về MySQL LIKE khi ES tắt.

## 🚀 Chạy bằng Docker (khuyên dùng)

Yêu cầu: **Docker Desktop**. Không cần cài Node/Python/MySQL trên máy.

```bash
# 1. Clone repo và chuyển nhánh integration
git clone -b integration https://github.com/nguyenngoc1211/LTW_zflix-.git
cd LTW_zflix-

# 2. Tạo file .env ở thư mục gốc từ mẫu
cp .env.example .env
# Sinh JWT_ACCESS_SECRET ngẫu nhiên rồi dán vào .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Khởi động toàn bộ stack (lần đầu sẽ build image khá lâu)
docker compose up --build

# 4. Truy cập
#    Frontend:  http://localhost:5173
#    Backend:   http://localhost:3000  ({"message":"Zflix API","status":"ok"})
```

MySQL container tự nạp `database/init.sql` khi tạo volume lần đầu (28 bảng + dữ liệu mẫu).
Nếu volume cũ chưa có bảng `production_interests`, chạy thêm:
```bash
docker compose exec -T db mysql -uroot -prootpassword movie_streaming_db < database/migrate-hai.sql
```

## 💻 Chạy thủ công không dùng Docker (Dev local)

Yêu cầu: Node.js ≥ 20, MySQL 8 (hoặc MariaDB ≥ 10.5, xem ghi chú bên dưới).

```bash
# 1. Database: tạo DB và nạp schema
mysql -u root -p -e "CREATE DATABASE movie_streaming_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p movie_streaming_db < database/init.sql

# 2. Backend
cd backend-node
cp .env.example .env        # sửa DATABASE_URL, JWT_ACCESS_SECRET cho máy bạn
npm install
npm run dev                 # chạy tại http://localhost:3000

# 3. Frontend (mở terminal khác)
cd frontend
npm install
npm run dev                 # chạy tại http://localhost:5173
```

> **Ghi chú MariaDB:** `init.sql` dùng collation `utf8mb4_0900_ai_ci` của MySQL 8. Trên
> MariaDB, chuyển collation khi import:
> `sed 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' database/init.sql | mysql -u root -p movie_streaming_db`

## 🔐 Biến môi trường

| File | Biến | Ý nghĩa |
| --- | --- | --- |
| `.env` (gốc, cho docker-compose) | `JWT_ACCESS_SECRET` | **Bắt buộc** — bí mật ký JWT (≥ 32 ký tự) |
| | `MFA_ENCRYPTION_KEY` | Base64 của 32 byte ngẫu nhiên, cần cho MFA ở production |
| | `FRONTEND_ORIGIN`, `NODE_ENV` | CORS origin và môi trường |
| `backend-node/.env` | `DATABASE_URL` | Chuỗi kết nối MySQL, vd `mysql://root:pass@localhost:3306/movie_streaming_db` |
| | `ELASTICSEARCH_URL` | **Tùy chọn** — bỏ trống/tắt ES thì search tự dùng MySQL |
| | `JWT_ACCESS_SECRET` và các biến `MFA_*`, rate-limit | Xem `backend-node/.env.example` |
| `frontend` | `VITE_API_URL` | Mặc định `http://localhost:3000`, chỉ cần đặt khi backend ở host khác |

Không có API key bên thứ ba nào được nhúng trong code. Các giá trị bí mật chỉ nằm trong
`.env` (đã liệt kê trong `.gitignore`).

## 🧪 Kiểm thử

```bash
cd backend-node
npm test                    # 19 unit test (auth, MFA, schema consistency, search, security logger)
npm run test:integration    # smoke test luồng auth (cần DB đang chạy)

cd frontend
npm run lint                # ESLint
npm run build               # build production
```

## 📚 Tài liệu thêm

- [Danh sách API các module Discovery/Community/Streaming](docs/HAI_API_REFERENCE.md)
- [Hướng dẫn merge và vận hành module của Hai](docs/HAI_MODULES_GUIDE.md)
- [Báo cáo kiểm thử branch Hai](docs/HAI_TEST_REPORT.md)
- [Hướng dẫn tích hợp authorization](docs/AUTHORIZATION_INTEGRATION_GUIDE.md)
- [Tiến độ bảo mật auth](docs/AUTH_SECURITY_PROGRESS.md)

## 👥 Đóng góp từ các nhánh

- `dev` — khung dự án, schema database, docker-compose, service Python
- `Du` — xác thực & bảo mật (login/register/MFA/reset password/session)
- `Hai` — discovery (tìm kiếm/lọc phim), community, streaming
- `Khoa` — watch party (Socket.IO real-time)
- `Nam`, `Ngoc` — (chưa có code trên nhánh)
