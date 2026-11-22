# Cấu trúc source Zflix

Cập nhật theo `main` tại `63cdba4` ngày 22/11/2026. Code tương ứng `0bc2732`; commit `63cdba4` chỉ sửa README. Khi tài liệu và code khác nhau, dùng source hiện tại làm căn cứ.

## Thành phần

| Thư mục | Vai trò |
|---|---|
| `frontend/` | React/Vite SPA cho người xem và trang admin. Route chính ở `src/routes/route.jsx`. |
| `backend-node/` | Express API và Socket.IO. Module nghiệp vụ ở `src/modules/`; điểm khởi động ở `src/server.js`, router ở `src/app.js`. |
| `backend-python/video-processor/` | FastAPI service chuyển video thành HLS và gọi webhook Node. |
| `backend-python/ai-chatbot/` | FastAPI chatbot RAG với MongoDB, ChromaDB, embedding/reranker và Gemini. |
| `database/` | SQL schema, seed và migration cho nhánh MySQL legacy. |
| `docs/` | Hướng dẫn, tiến độ migration, báo cáo và tài liệu theo từng thời điểm. |
| `docker-compose.yml` | Stack phát triển; MongoDB được cung cấp bên ngoài Compose. |

MongoDB là data store được cấu hình trong Compose và các file `.env.example`. Source vẫn có `mysql2`, MySQL fallback và Prisma legacy. Không kết luận việc chuyển mọi module sang MongoDB đã hoàn tất chỉ từ cấu hình Compose.

## Backend Node

### Core

| Đường dẫn | Vai trò |
|---|---|
| `src/app.js` | Cấu hình Express, middleware và mount API routers. |
| `src/server.js` | Tạo HTTP/Socket.IO server, đăng ký namespace và các worker. |
| `src/core/database/mongo.js` | Kết nối MongoDB, collection, numeric ID và transaction. |
| `src/core/database/pool.js` | MySQL pool cho phần code cũ. |
| `src/core/middleware/auth.middleware.js` | JWT/session auth, optional auth và role checks. |
| `src/core/security/` | Security config, entitlement, playback token và security logging. |
| `src/core/storage/` | R2 client và helpers upload/media. |

### Module API

| Module | Prefix hoặc mount | Nội dung |
|---|---|---|
| `auth/` | `/api/v1/auth` | Đăng ký/đăng nhập, refresh/logout, MFA, mật khẩu, session. |
| `discovery/` | `/api/v1` | Filters, productions, top phim, suggestions, reindex và API thêm episode. Elasticsearch dùng cho đường MySQL; MongoDB có truy vấn riêng. |
| `community/` | `/api/v1` | Favorites, interests, ratings, movie comments, notifications, posts, profiles/follow, points, quests và moderation. |
| `streaming/` | `/api/v1` | Chi tiết episode, history và playback access. |
| `streaming/route/` | `/api/streaming` | Route nội dung/phim/tập legacy, upload và webhook video; một số code vẫn phụ thuộc Prisma/MySQL. |
| `watch-party/` | `/api/v1` và Socket.IO | Phòng, participant, chat, playback và quyền host. |
| `payments/` | `/api/v1/vip`, `/api/v1/admin/vip-payments` | Gói VIP, đơn chuyển khoản xét duyệt thủ công. |
| `admin/` | `/api/v1/admin` | Dashboard, users, content, moderation, settings, reports/export. Quyền thay đổi theo route. |
| `shopping/` | `/api/v1` | Sản phẩm gắn theo phim/tập và khoảng thời gian, snapshot, click. |
| `visual-shopping/` | `/api/v1` | Lensy: `/scan`, `/visual-search`, catalog, stats và affiliate redirect. |
| `profile/` | `/api/v1/profile` | Avatar/profile endpoints. |

Các đường admin-only và staff-only được kiểm tra ở backend. Menu/route guard phía frontend chỉ hỗ trợ UX, không thay thế kiểm tra quyền API.

## Frontend

| Đường dẫn | Vai trò |
|---|---|
| `src/routes/route.jsx` | Khai báo route người xem, cộng đồng và admin. |
| `src/services/api.js` | Fetch wrapper, access token in-memory và refresh cookie. |
| `src/context/AuthContext.jsx` | Khôi phục và quản lý trạng thái đăng nhập. |
| `src/modules/discovery/` | Trang chủ, tìm kiếm, lọc. |
| `src/modules/streaming/` | Trang phim, player, history và redirect tập. |
| `src/modules/community/` | Feed, hồ sơ, thông báo, leaderboard, quests. |
| `src/modules/vip/` | Trang gói/đơn VIP người dùng. |
| `src/admin/` | Dashboard và trang quản trị. Admin hub có các mục nội dung, kiểm duyệt, điểm, nhiệm vụ và VIP. |
| `src/hooks/useLensy.js`, `src/services/scanApi.js` | Chọn vùng ảnh và gọi `/api/v1/scan`. |

Route chính gồm `/`, `/movies/:id`, `/community`, `/leaderboard`, `/quests`, `/vip`, `/watch-party`, `/settings` và `/admin/*`. Chi tiết khai báo nằm trong `frontend/src/routes/route.jsx`.

## Python services

- **Video processor** chạy FastAPI ở cổng 8001, cần R2 credentials và webhook secret để hoàn tất upload/HLS.
- **AI chatbot** chạy FastAPI ở cổng 8002. Router hiện tại mount `POST /api/v1/chat`; pipeline cần dữ liệu Chroma/BM25 và cấu hình Gemini để trả lời. Endpoint health ở `/`.

## Luồng Lensy

Player dùng `useLensy` để crop frame rồi gửi tới `POST /api/v1/scan`.

- `VISION_PROVIDER=deepseek` (cùng API key hợp lệ): provider nhận diện ảnh thành từ khóa, sau đó backend tìm sản phẩm trên Tiki.
- `VISION_PROVIDER=none`: CLIP tạo embedding và HNSW/cosine tìm trên `visual_products`.
- `POST /api/v1/visual-search`: đường CLIP trực tiếp, tách biệt với lựa chọn provider của `/scan`.

Catalog CSV import qua API không tự tính embedding. Trong working tree hiện tại, `npm run catalog:index` nhận `image_url` và trường `image_urls` tùy chọn, phân cách nhiều URL bằng `|` (tối đa 5 ảnh/sản phẩm), tạo vector cho từng ảnh rồi rebuild index. Vector index gộp các hit về product ID và giữ điểm cao nhất. Các thay đổi multi-image này còn chưa commit/push ở thời điểm cập nhật tài liệu, nên remote `main` (`63cdba4`) vẫn dùng một embedding chính cho mỗi sản phẩm. `products.sample.csv` là dữ liệu thử; kiểm tra ảnh khớp tên trước khi benchmark.

## Database và cấu hình

- `DATA_STORE=mongodb` chọn nhánh MongoDB tại các module đã hỗ trợ; Compose đặt chế độ này.
- `MONGODB_URI` và `MONGODB_DB_NAME` là cấu hình MongoDB. Transactions cần MongoDB deployment hỗ trợ transaction.
- `DATABASE_URL` phục vụ MySQL pool ở phần code cũ; không có cấu hình này thì route cũ còn gọi pool có thể không hoạt động.
- `database/init.sql` và migration SQL thuộc schema MySQL legacy, không tự nạp MongoDB Atlas.
- Cấu hình dùng chung nằm ở root `.env.example`; cấu hình Node local ở `backend-node/.env.example`.

## Lệnh kiểm tra

```powershell
cd backend-node
npm test
```

```powershell
cd frontend
npm run lint
npm run build
```

Script trong `backend-node/integration/` có thể ghi dữ liệu. Đọc guard trong từng script và dùng database test riêng trước khi chạy.
