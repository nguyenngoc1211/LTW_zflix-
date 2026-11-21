# 🎬 Zflix

Zflix là nền tảng xem phim trực tuyến dạng modular monorepo, kết hợp streaming, cộng đồng, Watch Party, quản trị nội dung và các dịch vụ AI tùy chọn.

Phiên bản hiện tại trên nhánh `main` sử dụng **MongoDB** làm kho dữ liệu chính khi chạy bằng Docker Compose.

## Chức năng chính

| Nhóm | Chức năng |
| --- | --- |
| Khám phá phim | Trang chủ, phim nổi bật, tìm kiếm, lọc, chi tiết phim, mùa và tập; Elasticsearch hỗ trợ tìm kiếm |
| Xem phim | Trình phát HLS, lịch sử xem, tiếp tục xem, nội dung VIP và xử lý video qua FastAPI/FFmpeg |
| Tài khoản & bảo mật | Đăng ký/đăng nhập, JWT + refresh cookie, MFA/TOTP, quên mật khẩu, quản lý phiên, khóa brute-force, rate limit và nhật ký bảo mật |
| Cộng đồng | Bài viết, bình luận/reply, ảnh và lightbox, vote/poll, lưu bài, hồ sơ, follow, feed theo dõi và câu hỏi theo cảnh phim |
| Điểm & nhiệm vụ | Điểm hoạt động, lịch sử điểm, bảng xếp hạng, nhiệm vụ, nhận thưởng và huy hiệu |
| Thông báo | Thông báo lưu trong MongoDB, realtime qua Socket.IO, mention/like/reply/tập mới/VIP và tùy chọn nhận thông báo |
| VIP | Gói tháng/năm, QR chuyển khoản, gửi yêu cầu và quy trình Admin/Moderator xét duyệt thủ công |
| Watch Party | Phòng xem chung realtime, đồng bộ phát/tạm dừng/tua, chat, mật khẩu và quản lý thành viên |
| Lensy | Khoanh vùng vật thể trong video, CLIP + HNSW tìm sản phẩm tương tự và ghi nhận affiliate click |
| Quản trị | Dashboard, phim/tập, cộng đồng, người dùng, kiểm duyệt, Points, nhiệm vụ, VIP, Watch Party, lượt xem, shopping và cấu hình hệ thống |
| AI chatbot *(tùy chọn)* | FastAPI RAG dùng chỉ mục BM25/Chroma và Gemini khi được cấu hình |

## Công nghệ và kiến trúc

```text
frontend/                 React 19, Vite 7, React Router 7, Tailwind CSS 4, Ant Design
backend-node/             Node.js 22, Express 5, MongoDB, Socket.IO, JWT, Helmet
backend-python/
├── video-processor/      FastAPI + FFmpeg, cổng 8001
└── ai-chatbot/           FastAPI + RAG, cổng 8002 (tùy chọn)
docker-compose.yml        Frontend, backend, Elasticsearch và hai service Python
docs/                     Thiết kế, API, bảo mật, triển khai và báo cáo kiểm thử
```

Các cổng mặc định:

| Dịch vụ | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Video processor | http://localhost:8001 |
| AI chatbot *(tùy chọn)* | http://localhost:8002 |
| Elasticsearch | http://localhost:9200 |

## Khởi chạy nhanh bằng Docker

### 1. Chuẩn bị

- Cài và mở Docker Desktop.
- Chuẩn bị MongoDB Atlas hoặc một MongoDB mà container có thể truy cập.
- Clone nhánh `main`:

```bash
git clone -b main https://github.com/nguyenngoc1211/LTW_zflix-.git
cd LTW_zflix-
```

### 2. Tạo `.env`

```bash
cp .env.example .env
```

Điền tối thiểu các biến sau:

```dotenv
MONGODB_URI=mongodb://...
MONGODB_DB_NAME=Zflix
JWT_ACCESS_SECRET=chuoi-ngau-nhien-toi-thieu-32-ky-tu
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
```

Sinh JWT secret bằng Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Không commit `.env`. Các cấu hình R2, ngân hàng, MFA, Lensy và Gemini được mô tả trong [`.env.example`](.env.example).

### 3. Chạy hệ thống web không có AI chatbot

```bash
docker compose up -d --build elasticsearch backend-node video-processor frontend
```

Mở http://localhost:5173. Kiểm tra backend tại http://localhost:3000; kết quả mong đợi:

```json
{"message":"Zflix API","status":"ok"}
```

Những lần sau chỉ cần:

```bash
docker compose up -d elasticsearch backend-node video-processor frontend
```

Xem trạng thái và log:

```bash
docker compose ps
docker compose logs -f backend-node frontend
```

Dừng hệ thống:

```bash
docker compose stop
```

### 4. Bật AI chatbot *(tùy chọn)*

AI chatbot không bắt buộc đối với web chính. Lần build đầu tải nhiều thư viện ML và có thể mất khá lâu.

```bash
docker compose build ai-chatbot
docker compose run --rm ai-chatbot python -m src.ingestion.run_ingest
docker compose up -d ai-chatbot
```

Khi catalog phim thay đổi:

```bash
docker compose run --rm ai-chatbot python -m src.ingestion.run_ingest --force
```

Đặt `GEMINI_API_KEY` trong `.env` nếu muốn chatbot sinh câu trả lời bằng Gemini.

## Chạy local để phát triển

Yêu cầu: Node.js 20+, MongoDB và Elasticsearch có thể truy cập.

Backend:

```bash
cd backend-node
cp .env.example .env
npm install
npm run dev
```

Frontend, trong terminal khác:

```bash
cd frontend
npm install
npm run dev
```

Frontend tự dùng backend tại `http://localhost:3000` nếu không đặt `VITE_API_URL`.

## Các trang quan trọng

### Người dùng

- `/` — trang chủ và khám phá phim
- `/community` — cộng đồng
- `/leaderboard` — bảng xếp hạng điểm
- `/quests` — nhiệm vụ và phần thưởng; yêu cầu đăng nhập
- `/library`, `/history`, `/notifications`, `/settings`, `/vip` — khu vực tài khoản
- `/watch-party` — danh sách phòng xem chung

### Quản trị

Truy cập trực tiếp `/admin-login`. Khu vực `/admin` chỉ dành cho `admin` hoặc `moderator`; backend vẫn kiểm tra quyền riêng cho từng API.

Community Hub tại `/admin/community-hub` gồm:

- tổng quan và quản lý nội dung;
- người dùng và kiểm duyệt;
- Points, nhiệm vụ và huy hiệu;
- VIP, doanh thu và xét duyệt thanh toán.

Các trang quản trị khác gồm phim/tập, Watch Party, thống kê lượt xem, shopping, nhật ký bảo mật và cài đặt.

## Biến môi trường đáng chú ý

| Biến | Bắt buộc | Mục đích |
| --- | --- | --- |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Có | Kết nối và tên database MongoDB |
| `JWT_ACCESS_SECRET` | Có | Ký access token, tối thiểu 32 ký tự |
| `FRONTEND_ORIGIN` | Có | Danh sách origin được CORS cho phép |
| `MFA_ENCRYPTION_KEY` | Khi dùng MFA production | Khóa base64 của đúng 32 byte |
| `R2_*`, `VIDEO_WEBHOOK_SECRET` | Khi upload/xử lý video | Cloudflare R2 và xác thực webhook |
| `VIP_BANK_*` | Khi nhận chuyển khoản | Thông tin tài khoản và QR thanh toán |
| `POINTS_MONTH_CLOSE_ENABLED` | Không | Bật/tắt job chốt điểm tháng; mặc định `true` trong Compose |
| `VISION_PROVIDER`, `DEEPSEEK_*` | Không | Provider nhận diện cho Lensy |
| `GEMINI_API_KEY` | Không | AI chatbot |
| `VITE_API_URL` | Không | URL backend khi không chạy cùng máy frontend |

## Kiểm thử

Backend unit test:

```bash
cd backend-node
npm test
```

Smoke test auth cơ bản, yêu cầu database test được cấu hình:

```bash
npm run test:integration
```

Repo còn có smoke test riêng trong `backend-node/integration/` cho community, notification, VIP, Points, quests, moderation và quản trị nội dung. Không chạy chúng trên database production.

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run test:ui
```

Các smoke test UI bổ sung nằm trong `frontend/integration/` và `frontend/tests/`.

## Lưu ý vận hành

- MongoDB Atlas phải cho phép IP công cộng hiện tại trong **Network Access**.
- Elasticsearch không chứa dữ liệu gốc; backend có thể xây lại search index từ catalog MongoDB.
- Thanh toán VIP hiện là chuyển khoản và xét duyệt thủ công, không phải cổng ngân hàng tự động.
- R2 chỉ cần thiết cho upload/video HLS và các luồng media dùng object storage.
- Bật Git hook chống commit nhầm secret bằng `git config core.hooksPath .githooks`.

## Tài liệu

- [Cấu trúc dự án](docs/PROJECT_STRUCTURE.md)
- [API Discovery, Community và Streaming](docs/HAI_API_REFERENCE.md)
- [Thiết kế database Community](docs/COMMUNITY_DATABASE_DESIGN.md)
- [Tiến độ bảo mật Auth](docs/AUTH_SECURITY_PROGRESS.md)
- [Hệ thống Notification](docs/NOTIFICATION_P1.md)
- [Triển khai](docs/DEPLOYMENT.md)
- [Hướng dẫn setup cho nhóm](docs/SETUP_TEAM.md)
- [Báo cáo dự án cập nhật](docs/ZFLIX_PERSONAL_REPORT.md)

## Bảo mật

Không đưa `.env`, MongoDB URI, JWT secret, R2 key hoặc API key vào commit. Nếu secret từng bị chia sẻ hoặc commit, hãy thu hồi/đổi secret trước, sau đó mới làm sạch lịch sử Git nếu cần.
