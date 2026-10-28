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
| **Admin** | nhánh `Ngoc` | Hệ quản trị riêng cho admin: dashboard tổng quan, quản lý người dùng (tìm kiếm/đổi role/khóa tài khoản), quản lý phim (VIP/trạng thái), thống kê lượt xem (biểu đồ 30 ngày, top phim, theo thể loại). Đăng nhập qua URL ẩn `/admin-login` |
| **AI Visual Shopping** | nhánh `Ngoc` | Quét khoanh vùng món đồ trong khung hình -> **CLIP self-hosted** (ViT-B/32, Transformers.js/ONNX, load sẵn trong RAM) tạo embedding -> **HNSW index** tìm sản phẩm tương tự trong Local Catalog (import CSV/JSON) -> panel kết quả (ảnh, giá VND, % giống) -> affiliate redirect có ghi click. Vision LLM (Gemini/SerpAPI) chỉ là fallback tùy chọn. Timing riêng từng bước: crop/embed/search/rank |

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

## 🛡️ Hệ quản trị (Admin)

Trang đăng nhập quản trị **ẩn** với người dùng thường — không có link nào từ giao diện
người dùng; truy cập trực tiếp: **`/admin-login`** (vd `http://localhost:5173/admin-login`).

- Tài khoản không phải admin/moderator đăng nhập tại đây sẽ bị **từ chối và thu hồi phiên ngay**.
- Sau khi đăng nhập: `/admin` (Tổng quan), `/admin/movies`, `/admin/community`, `/admin/parties`,
  `/admin/views`, `/admin/users`, `/admin/subscriptions`, `/admin/security`, `/admin/settings`.
- Người dùng thường vào `/admin` sẽ bị chuyển hướng về trang chủ.

**Chức năng theo trang:**

| Trang | Chức năng |
| --- | --- |
| Tổng quan | Thẻ số liệu toàn hệ thống + người dùng mới nhất |
| Quản lý phim | Thêm/sửa/xóa phim + thể loại, quản lý tập (thêm tập tự gửi thông báo người quan tâm), toggle VIP/trạng thái, nút reindex Elasticsearch |
| Cộng đồng | Duyệt/xóa bình luận & đánh giá, gửi thông báo hàng loạt |
| Watch Party | Theo dõi phòng, kết thúc/xóa phòng vi phạm |
| Thống kê lượt xem | Biểu đồ 30 ngày, người dùng hoạt động/mới, top phim, pie thể loại |
| Quản lý người dùng | Tìm kiếm, phân trang, đổi role (user/moderator/admin), khóa/mở khóa |
| VIP & Doanh thu | Doanh thu theo tháng, đăng ký VIP, kích hoạt VIP thủ công (ghi giao dịch + thông báo) |
| Nhật ký bảo mật | Log đăng nhập/MFA/khóa tài khoản từ bảng `security_events` |
| Cài đặt | Chọn phim nổi bật làm banner trang chủ, export CSV (users/transactions) |

**Phân quyền:** `admin` toàn quyền; `moderator` chỉ quản lý nội dung (phim, cộng đồng,
watch party, thống kê) — không xem được người dùng, doanh thu, nhật ký, cài đặt.
Cấp moderator trong trang Quản lý người dùng. Migration: `database/migrate-ngoc.sql`.

Dữ liệu mẫu có sẵn tài khoản `admin@moviehub.com` nhưng mật khẩu trong dump đã hash. Để đặt
lại mật khẩu admin trên máy bạn (ví dụ `Admin@12345`):

```bash
cd backend-node
node -e "const b=require('bcryptjs');console.log(b.hashSync('Admin@12345',12))"   # copy hash
mysql -u root -p -e "UPDATE movie_streaming_db.users SET password='<hash>' WHERE email='admin@moviehub.com'"
```

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

MySQL container tự nạp `database/init.sql` khi tạo volume lần đầu (32 bảng + dữ liệu mẫu) và
`database/migrate-visual-shopping.sql` (3 bảng visual shopping). Tổng cộng **35 bảng**.
Nếu volume cũ chưa có bảng `production_interests`, chạy thêm:
```bash
docker compose exec -T db mysql -uroot -prootpassword movie_streaming_db < database/migrate-hai.sql
```

## 💻 Chạy thủ công không dùng Docker (Dev local)

### Cách nhanh nhất — 1 lệnh (Windows)

```cmd
setup-zflix.bat
start-zflix.bat
```

`setup-zflix.bat` tự tìm MySQL, tạo database đủ 35 bảng, sinh `.env` với secret ngẫu nhiên,
cài dependency và đặt mật khẩu dev. Chi tiết + xử lý lỗi: **[docs/SETUP_TEAM.md](docs/SETUP_TEAM.md)**.

Tài khoản demo sau khi cài: `admin@moviehub.com` / `Zflix@2026`

### Cách thủ công

Yêu cầu: Node.js ≥ 20, MySQL 8 (hoặc MariaDB ≥ 10.8, xem ghi chú bên dưới).

```bash
# 1. Database: tạo DB, nạp schema (32 bảng) + 3 bảng visual shopping
mysql -u root -p -e "CREATE DATABASE movie_streaming_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p movie_streaming_db < database/init.sql
mysql -u root -p movie_streaming_db < database/migrate-visual-shopping.sql

# 2. Backend
cd backend-node
cp .env.example .env        # sửa DATABASE_URL, JWT_ACCESS_SECRET cho máy bạn
npm install
npx prisma generate         # bắt buộc: module quản lý phim dùng Prisma
npm run migrate:auth
npm run db:password         # đặt mật khẩu dev (nếu không, không đăng nhập được)
npm run dev                 # chạy tại http://localhost:3000

# 3. Frontend (mở terminal khác)
cd frontend
npm install
npm run dev                 # chạy tại http://localhost:5173
```

> **Ghi chú MariaDB:** `init.sql` là dump từ MySQL 8.0 nên chứa `utf8mb4_0900_ai_ci` — collation
> mà MariaDB không có (lỗi `1273 Unknown collation`). Thay trước khi import:
> `sed 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' database/init.sql | mysql -u root -p movie_streaming_db`
> (`setup-zflix.bat` tự làm bước này.)

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

**Chống lộ secret:** repo có hook chặn commit file `.env` — bật cho máy của bạn sau khi
clone (1 lần):

```bash
git config core.hooksPath .githooks
```

Nếu lỡ tay commit secret thật: **revoke/đổi key ngay** ở nhà cung cấp (Gemini/Shopee...),
rồi dọn history bằng `git filter-repo` trước khi force-push (cần đồng ý cả nhóm).

## 🧪 Kiểm thử

```bash
cd backend-node
npm test                    # 30 unit test
npm run catalog:index       # tải catalog CSV, tạo CLIP embeddings + rebuild HNSW index (auth, MFA, schema, search, security logger, vision parser)
npm run test:integration    # smoke test luồng auth (cần DB đang chạy)
npm run seed:omdb           # nạp dữ liệu phim THẬT từ OMDb (cần OMDB_API_KEY, key free tại omdbapi.com/apikey.aspx)
                            # + video hợp pháp: Blender open movies / Archive.org
                            # Lưu ý: script xóa nội dung content tables, giữ nguyên users

cd frontend
npm run lint                # ESLint
npm run build               # build production
```

## 📚 Tài liệu thêm

- [Cấu trúc dự án cho thành viên mới](docs/PROJECT_STRUCTURE.md)
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
- `Ngoc` — hệ quản trị admin (dashboard, quản lý user/phim, thống kê lượt xem)
- `Nam` — (chưa có code trên nhánh)
