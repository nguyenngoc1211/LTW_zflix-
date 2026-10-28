# Zflix — Cấu trúc dự án

Tài liệu định hướng cho thành viên mới: mỗi thư mục/file chính làm gì, luồng dữ liệu
đi qua đâu, và nên đặt code mới ở đâu. Cập nhật lần cuối: 2026-10-28.

> Tài liệu liên quan: [SETUP_TEAM](SETUP_TEAM.md), [DEPLOYMENT](DEPLOYMENT.md),
> [API reference](HAI_API_REFERENCE.md), [Auth & Security](AUTH_SECURITY_PROGRESS.md),
> [Phân tích dự án](project-analysis/README.md).

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Cổng | Entrypoint |
|---|---|---|---|
| Frontend | React 19 + Vite + Tailwind + Ant Design | 5173 | `frontend/src/main.jsx` |
| Backend API + Socket.IO | Node.js + Express 5 | 3000 | `backend-node/src/server.js` |
| Video Processor | Python FastAPI + ffmpeg | 8001 | `backend-python/video-processor/src/main.py` |
| AI Chatbot | Python FastAPI (khung) | 8002 | `backend-python/ai-chatbot/src/main.py` |
| Database | MySQL/MariaDB `movie_streaming_db` | 3306 | `database/init.sql` |
| Search | Elasticsearch (tuỳ chọn, có fallback SQL) | 9200 | index `productions` |
| Object storage | Cloudflare R2 (video, HLS, ảnh) | — | `backend-node/src/core/storage/` |

Backend dùng **hai lớp truy cập DB song song**:

- `mysql2/promise` (`core/database/pool.js`) cho phần lớn API, auth và các bảng vận hành.
- Prisma (`core/database/prisma.js`) cho CRUD nội dung phim/tập/mùa ở `/api/streaming`.

Không thêm thư viện ORM mới; chọn một trong hai lớp đang có theo module tương ứng.

---

## 2. Cây thư mục tổng quan

```text
LTWcode/
├─ backend-node/            Node API, Socket.IO, Prisma schema, test
├─ frontend/                React SPA (user + admin)
├─ backend-python/
│  ├─ video-processor/      Nhận job upload, cắt HLS, upload R2, gọi webhook
│  └─ ai-chatbot/           Service chatbot (hiện chỉ có endpoint khung)
├─ database/                Dump khởi tạo + các migration SQL
├─ docs/                    Tài liệu kỹ thuật và biên bản phân tích
├─ tools/                   Script setup/ERD dùng chung
├─ .backups/                Bản dump DB trước các thao tác lớn (không commit schema mới)
├─ docker-compose.yml       Stack đầy đủ: db, ES, backend, video, chatbot, frontend
├─ start-zflix.bat          Khởi động 1 lệnh trên Windows (dev local)
├─ stop-zflix.bat           Dừng các tiến trình dev
└─ setup-zflix.bat          Cài dependency / seed ban đầu
```

---

## 3. backend-node

### 3.1. Entrypoint và cấu hình

| File | Vai trò |
|---|---|
| `src/server.js` | Tạo HTTP server, gắn Socket.IO, đăng ký namespace watch party, đồng bộ index tìm kiếm |
| `src/app.js` | Tạo Express app, middleware bảo mật, mount toàn bộ router, 404/error handler |
| `src/config/security.config.js` | JWT, CORS, thời hạn token, rate limit đọc từ env |
| `src/config/video-service.config.js` | URL service xử lý video (mặc định `127.0.0.1:8001`) |
| `prisma/schema.prisma` | Nguồn schema Prisma Client cho nội dung phim |
| `prisma.config.ts` | Cấu hình Prisma CLI |

### 3.2. Thư mục `src/core`

| Thư mục | Nội dung |
|---|---|
| `core/database/` | `pool.js` (mysql2), `prisma.js` (Prisma Client) |
| `core/middleware/` | `auth.middleware.js` (JWT/session), `business-auth.bridge.js` (auth cho module cũ), rate limit, origin |
| `core/security/` | Ghi security event ra console và bảng `security_events` |
| `core/storage/` | `r2.js` (S3 client), `upload.helper.js` (multer), `public-url.js` (đổi key R2 thành URL public) |
| `core/utils/` | `http.js`: `asyncHandler`, `parsePositiveInt`, helper response |

Các file tên `Test.js` là mã nháp/legacy, không được import trong luồng chạy.

### 3.3. Các module nghiệp vụ

Mỗi module thường gồm `*.routes.js` (định nghĩa endpoint) và `*.service.js`
(truy vấn/xử lý). Riêng `streaming` tách thêm `controllers/` và `route/`.

| Module | Prefix mount | Chức năng chính |
|---|---|---|
| `auth/` | `/api/v1/auth` | Đăng ký, đăng nhập, refresh cookie, MFA, reset password, session |
| `discovery/` | `/api/v1` | Trang chủ, tìm kiếm/lọc, chi tiết phim, đồng bộ Elasticsearch |
| `community/` | `/api/v1` | Watchlist, lịch sử xem, comment, rating, thông báo |
| `streaming/` | `/api/v1` | API xem phim/episode cho người dùng, proxy R2 |
| `streaming/route/` | `/api/streaming` | CRUD nội dung phim/tập/mùa (Prisma + R2), webhook video |
| `watch-party/` | `/api/v1` + Socket.IO `/watch-party` | Phòng xem chung, chat, đồng bộ phát |
| `admin/` | `/api/v1/admin` | Dashboard, user, moderation, cấu hình hệ thống |
| `shopping/` | `/api/v1` | Sản phẩm gắn mốc phim, affiliate Shopee |
| `visual-shopping/` | `/api/v1/visual-search`, `/api/v1/scan` | Tìm sản phẩm bằng ảnh (DeepSeek vision + tra sàn Tiki, fallback CLIP/HNSW) |

Quy ước quyền:

- Đọc nội dung streaming là public (`GET`).
- Ghi nội dung (`POST/PUT/DELETE` dưới `/api/streaming`) yêu cầu `admin`/`moderator`.
- Webhook `/api/streaming/episodes/webhook/video-done` xác thực bằng header
  `x-webhook-secret`, không dùng JWT.
- `/api/v1/admin/*` yêu cầu đăng nhập; một số màn chỉ dành cho `admin`.

### 3.4. Proxy media

`modules/streaming/r2-proxy.routes.js` phục vụ `/api/v1/hls/*`. Trình duyệt không tải
trực tiếp được file trên R2 (thiếu CORS), nên frontend luôn phát qua proxy này; proxy
giữ nguyên `Range` để tua video.

### 3.5. Test và script

```bash
cd backend-node
npm test                  # node:test, 35 test hiện tại
npm run test:integration  # smoke auth/MFA/password/registration
npm run seed:omdb         # seed dữ liệu phim (xóa dữ liệu cũ, đọc kỹ cảnh báo)
npm run restore:r2        # phục hồi 2 phim demo HLS sau khi seed
npm run catalog:index     # build index catalog cho visual shopping
```

Thư mục `scripts/` chứa seed, migration auth, benchmark, kiểm tra SerpAPI.
Thư mục `integration/` chứa smoke test gọi API thật.

---

## 4. frontend

### 4.1. Entrypoint

| File | Vai trò |
|---|---|
| `src/main.jsx` | Mount React, RouterProvider, Ant Design |
| `src/App.jsx` | Layout chung (header/footer), Outlet |
| `src/routes/route.jsx` | Toàn bộ route user và admin |
| `src/routes/ProtectedRoute.jsx` | Chặn route theo đăng nhập/role |
| `src/services/api.js` | Fetch wrapper, access token trong bộ nhớ, refresh cookie |
| `src/context/AuthContext.jsx` | Trạng thái đăng nhập dùng chung |

### 4.2. Route chính

| Route | Trang |
|---|---|
| `/` | `modules/discovery/HomePage.jsx` |
| `/movies/:id` | `modules/discovery/MovieDetailPage.jsx` |
| `/watch/:slug` | `WatchPageWrapper` (không có `?ep=` → thông tin; có `?ep=` → trình phát) |
| `/watch-episode/:episodeId` | `PlayerPage` (dùng cho lịch sử xem) |
| `/library`, `/history`, `/notifications` | Cần đăng nhập |
| `/watch-party`, `/watch-party/create`, `/watch-party/room/:partyId` | Danh sách/tạo phòng/phòng xem |
| `/account/security` | Bảo mật tài khoản |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/admin-login` | Auth |
| `/admin/*` | Khu quản trị, `admin`/`moderator` (một số màn chỉ `admin`) |

### 4.3. Thư mục

| Thư mục | Nội dung |
|---|---|
| `src/modules/auth/` | Các trang đăng nhập/đăng ký/bảo mật |
| `src/modules/discovery/` | Trang chủ, chi tiết phim |
| `src/modules/community/` | Thư viện, thông báo |
| `src/modules/streaming/` | Watch page, player, lịch sử xem |
| `src/admin/` | Màn quản trị: analytics, content, users, security, settings, shopping... |
| `src/components/streamingPage/` | Player, chọn tập/mùa, comment, gợi ý, phim liên quan |
| `src/components/streamingDetailPage/` | Hero + thông tin phim |
| `src/components/layout/`, `src/components/*.jsx` | Layout, header, card, widget chatbot, overlay quét ảnh |
| `src/hooks/` | Hook dùng chung (auth, Lensy, chọn vùng ảnh, nguồn video) |
| `src/hooks/streaming/` | Hook riêng cho watch page (fetch tập, watchlist, share URL) |
| `src/services/` | API client, movie service, scan API, Socket.IO client |
| `src/utils/` | Tiện ích màu, crop ảnh, chụp khung hình video |
| `src/pages/` | Trang watch party |

`services/socket.js` kết nối namespace `/watch-party`, gửi access token qua
`socket.handshake.auth.token`.

### 4.4. Phát video

`hooks/useVideoSource.js` gắn nguồn vào thẻ `<video>`:

1. URL R2 (`*.r2.dev`) được đổi sang `/api/v1/hls/<key>` để đi qua proxy backend.
2. `.m3u8` dùng `hls.js` trên Chrome/Firefox; Safari phát native.
3. `.mp4` phát trực tiếp.

---

## 5. backend-python

```text
video-processor/
├─ Dockerfile              # Cài ffmpeg trong image
├─ requirements.txt        # fastapi, uvicorn, boto3, ffmpeg-python...
├─ .env.example            # R2 + URL webhook + secret
└─ src/
   ├─ main.py              # POST /process-video
   ├─ schemas/video.py     # Body: file_name, production_id, episode_id
   ├─ services/video_processor.py
   └─ core/{config,storage}.py
```

Luồng xử lý HLS:

```text
Admin upload (Node, multer)
  -> file lên R2 tại raw/movies|series/<tên>
  -> Node POST :8001/process-video
  -> Python tải file về, chạy ffmpeg -c copy -> HLS
  -> upload hls/<base>/playlist.m3u8 + segment .ts lên R2
  -> Python POST /api/streaming/episodes/webhook/video-done (x-webhook-secret)
  -> Node cập nhật episodes.video_url
  -> Client phát qua /api/v1/hls/hls/<base>/playlist.m3u8
```

Yêu cầu môi trường: **ffmpeg phải có trong PATH** (`winget install Gyan.FFmpeg`).
Nếu ffmpeg không có, video vẫn phát được bằng file raw nhưng không có HLS/adaptive.

`ai-chatbot/` hiện là khung FastAPI, chưa nối vào backend; widget chat ở frontend là
phần UI độc lập.

---

## 6. Database

| File | Vai trò |
|---|---|
| `database/init.sql` | Dump khởi tạo `movie_streaming_db` (bảng nội dung, user, auth, watch party...) |
| `database/migrate-ngoc.sql` | Migration admin/dashboard |
| `database/migrate-hai.sql` | Migration discovery/community/streaming |
| `database/migrate-shopping.sql` | Sản phẩm gắn mốc thời gian trong phim |
| `database/migrate-visual-shopping.sql` | Catalog ảnh, vector, affiliate |
| `backend-node/prisma/schema.prisma` | Model Prisma cho nội dung; dùng cho `prisma generate` |

Các nhóm bảng chính trong schema Prisma:

- Nội dung: `productions`, `movies`, `series`, `seasons`, `episodes`, `genres`, `actors`,
  `production_genres`, `production_actors`.
- Người dùng: `users`, `bookmarks`, `ratings`, `comments`, `comment_likes`,
  `watch_history`, `notifications`, `subscription_plans`, `user_subscriptions`,
  `transactions`.
- Watch party: `watch_parties`, `watch_party_participants`, `watch_party_chats`.
- Thống kê: `daily_stats`.

Các bảng vận hành như `auth_sessions`, `security_events`, `app_settings` và bảng
shopping được tạo bởi SQL/migration, không khai báo trong Prisma.

Quy ước khi đổi schema:

1. Sửa `schema.prisma` nếu bảng thuộc nội dung Prisma quản lý.
2. Viết migration idempotent `database/migrate-*.sql` cho DB đang chạy.
3. Chạy `npx prisma generate`; không `migrate dev` trực tiếp trên DB demo dùng chung.

---

## 7. Script vận hành

| Lệnh | Tác dụng |
|---|---|
| `start-zflix.bat` | Kiểm tra MySQL, Prisma, backend, video processor, frontend; in URL |
| `stop-zflix.bat` | Dừng các cổng 3000/5173/8001 |
| `setup-zflix.bat` | Cài dependency và seed lần đầu |
| `node tools/zflix-setup.mjs` | Logic setup chi tiết (DB, user demo, dữ liệu mẫu) |
| `node tools/generate-prisma-erd.mjs` | Sinh ERD từ Prisma schema |
| `docker compose up --build` | Chạy toàn bộ stack bằng Docker |

Lưu ý Windows:

- `start-zflix.bat` tự bỏ qua `prisma generate` nếu backend đang chạy (DLL bị khóa).
- Script đặt `PYTHONUTF8=1` cho video processor để log không làm job crash.
- File batch/JSON không được lưu kèm BOM; BOM từng làm Prisma đọc `package.json` lỗi.

---

## 8. Luồng nghiệp vụ chính

### 8.1. Xác thực

```text
POST /api/v1/auth/login
  -> access token (15m, giữ trong bộ nhớ frontend)
  -> refresh token trong cookie httpOnly + bản ghi auth_sessions
  -> request sau: Authorization: Bearer <access token>
  -> hết hạn: POST /api/v1/auth/refresh-token (cookie)
```

Socket.IO watch party dùng cùng access token ở handshake; server kiểm tra
`auth_sessions` còn hiệu lực trước khi cho join phòng.

### 8.2. Xem phim

```text
/watch/:slug
  -> GET chi tiết production + danh sách tập
  -> chọn tập -> GET episode
  -> useVideoSource: R2 URL -> /api/v1/hls/... -> hls.js hoặc native
  -> ghi lịch sử xem định kỳ
```

### 8.3. Tìm kiếm

`discovery/search.service.js` đồng bộ production sang Elasticsearch khi server khởi
động. Nếu Elasticsearch không sẵn sàng, API tìm kiếm fallback sang SQL và ghi cảnh báo.

### 8.4. Visual shopping

```text
Ảnh/chụp màn hình
  -> AI nhận diện (DeepSeek/Gemini) + OCR (tesseract.js) chạy song song
  -> từ khoá AI -> tìm sản phẩm thật trên Tiki (marketplace.js, cache 5 phút)
  -> chưa cấu hình AI: fallback embedding CLIP + HNSW trên catalog demo
```

---

## 9. Đặt code mới ở đâu

| Loại thay đổi | Vị trí |
|---|---|
| Endpoint REST mới | `backend-node/src/modules/<domain>/<domain>.routes.js`, mount trong `app.js` |
| Nghiệp vụ/DB mới | Thêm `*.service.js` cùng module; dùng `pool` hoặc Prisma theo module |
| Trang user mới | `frontend/src/modules/<domain>/`, thêm route trong `routes/route.jsx` |
| Trang admin mới | `frontend/src/admin/<domain>/`, thêm route dưới `/admin` và kiểm tra role |
| Component dùng chung | `frontend/src/components/` hoặc `hooks/` |
| Job xử lý video | `backend-python/video-processor/src/services/` |
| Bảng/config mới | `database/migrate-<ten>.sql` + cập nhật Prisma nếu cần |
| Tài liệu | `docs/`; cập nhật `AUTH_SECURITY_PROGRESS.md` sau mỗi thay đổi auth |

Quy ước chung:

- Không sửa module ngoài phạm vi task.
- Không tạo API backend mới chỉ để phục vụ mock frontend.
- Đọc code hiện tại trước khi tin tài liệu cũ (code là nguồn sự thật).
- Không commit file `.env`, log, dump trong `.backups/`, hay ảnh upload tạm.

---

## 10. Lệnh kiểm tra nhanh

```bash
# Backend
cd backend-node && npm test

# Frontend
cd frontend && npm run lint && npm run build

# Sức khỏe dịch vụ
curl http://localhost:3000/            # {"message":"Zflix API","status":"ok"}
curl -o /dev/null -w "%{http_code}\n" http://localhost:8001/docs   # Swagger video processor
```

## 11. Ghi chú kỹ thuật / nợ cần biết

- R2 không trả CORS: mọi media phải đi qua `/api/v1/hls`, không phát trực tiếp.
- Upload xong nhưng chưa có HLS: `episodes.video_url` tạm là key `raw/...`; backend đổi
  thành URL public để phát ngay, sau đó webhook thay bằng `playlist.m3u8`.
- Elasticsearch và ffmpeg là tuỳ chọn khi dev nhưng cần cho đầy đủ tính năng.
- Watch party: token chỉ kiểm tra lúc handshake, không kiểm tra lại giữa phiên.
- Các file `Test.js`/`Test.jsx` rải rác là mã nháp, không thuộc luồng chạy.
