# Zflix — Bản đồ hiểu biết toàn dự án

> Tạo bằng cách **đọc trực tiếp source code** (không dựa vào README), đối chiếu database đang chạy và
> các tài liệu sẵn có. Khi tài liệu khác source, **source là chân lý** (đúng quy ước `AGENTS.md` và
> `docs/AUTH_SECURITY_PROGRESS.md`).
>
> Phạm vi: 156 file / **17.564 dòng** (backend-node 8.263, frontend 6.251, database 1.187, docs 1.466,
> tools 233, backend-python 13), không tính `node_modules`, `dist`, `.git`, model ONNX.

---

## 1. Cách đọc & độ tin cậy

| Mức | Nội dung |
| --- | --- |
| **Đọc 100% từng dòng** | `server.js`, `app.js`, `core/*`, `security.config.js`, `auth.service.js` (872), `auth.routes.js` (565), `mfa.js`, `password-reset-delivery.js`, `migrate-auth.js`, 3 migration auth, `discovery.routes.js`, `community.routes.js`, `streaming.routes.js`, `watch-party.socket.js` (263), `frontend/src/services/*`, `AuthContext.jsx`, `routes/*`, `App.jsx`, `Navbar.jsx`, `main.jsx`, toàn bộ `test/*` |
| **Đọc qua báo cáo chuyên sâu, đối chiếu chéo** | `admin.*.routes.js` (931 dòng/31 endpoint), `watch-party.routes.js` (524), toàn bộ `frontend/src` còn lại, `shopping`/`visual-shopping` (1.159 dòng), `database/init.sql` + migrations |
| **Kiểm chứng runtime** | 35 bảng thật trong MySQL, số bản ghi từng bảng, cột `users`/`auth_sessions`, 51 user/228 phim/1.125 tập |
| **Chưa kiểm chứng** | Hành vi dưới HTTPS thật, email provider, benchmark CLIP trên máy khác, Docker (máy không có Docker) |

Môi trường: Node v22.21.0, npm 11.6.2, Python 3.14 (chưa có fastapi/uvicorn), MariaDB XAMPP
`C:\xampp\mysql`, **không có Docker**. Git: nhánh `integration`, tree sạch, HEAD `1386e14`,
`core.hooksPath=.githooks`.

---

## 2. Kiến trúc tổng thể

```
frontend/        React 19 + Vite 7 + Tailwind 4 + antd 5 (chỉ admin) + react-router 7   :5173
backend-node/    Express 5 (ESM) + mysql2 + Socket.IO + helmet + JWT + CLIP/HNSW/OCR    :3000
backend-python/  2 stub FastAPI (không ai gọi)                                          :8001 :8002
database/        init.sql (32 bảng + seed) + 4 migration                                MySQL :3306
tools/           1 script sinh ERD (đã hỏng)
docs/            9 tài liệu — phần lớn đã lỗi thời so với nhánh integration
```

**Luồng phụ thuộc thật**

- Trình duyệt → `:5173` → gọi thẳng `http://localhost:3000` bằng `fetch` (`frontend/src/services/api.js:1`);
  `vite.config.js` **không có** `server.proxy`.
- REST: `Authorization: Bearer <accessToken>` (memory-only) + cookie `refreshToken` (httpOnly, `path=/api/v1/auth`).
- Realtime: Socket.IO namespace `/watch-party`, `withCredentials: true`, **không token**.
- `backend-python` **không được gọi từ đâu**: grep `8001|8002|chatbot|video-processor` trong
  `backend-node/src` + `frontend/src` → 0 hit. Stub còn lại từ nhánh `dev`.
- MySQL qua `mysql2` pool (10 connection, `timezone: "Z"`); Elasticsearch tùy chọn, tắt thì
  fallback MySQL LIKE.
- Tổng **≈108 endpoint REST**: auth 18, discovery 6, community 16, streaming 5, watch-party 13,
  shopping 9, visual-shopping 7, scan 2, admin 30 + 2 route app-level (`/settings/featured`, `/admin/check`).

---

## 3. Backend core

### 3.1 Khởi động (`src/server.js`, 54 dòng)

`dotenv` → gắn sink `security_events` (INSERT bất đồng bộ, lỗi bị nuốt) → `createServer(app)` →
`new Server(httpServer, { cors: { origin: FRONTEND_ORIGIN, credentials: true } })` → đăng ký socket →
`listen` → `syncProductionIndex()` **trong cùng process**.

**Lỗi cấu hình**: Socket.IO nhận **nguyên chuỗi** `FRONTEND_ORIGIN` (`server.js:34,41`) trong khi Express
dùng mảng đã tách (`app.js:40`). `.env` có 2 origin (`5173,4173`) ⇒ CORS socket sai khi cấu hình nhiều origin.

### 3.2 Middleware chain (`src/app.js`, 105 dòng)

```
/uploads static → helmet (CSP tắt) → cors(origins[], credentials)
→ json 5mb cho /visual-search, /scan, /shopping/admin/catalog → json 32kb global → cookieParser
→ GET /  →  /api/v1/auth  →  /api/v1 (7 router)  →  /api/v1/admin (4 router)
→ GET /api/v1/settings/featured  →  GET /api/v1/admin/check  →  404  →  error handler
```

- **Không CSRF token**: bù bằng `SameSite=Lax` + `requireFrontendOrigin` (header `Origin`) cho route dùng cookie.
- Không request-id, không access log, không nén, không rate limit toàn cục.
- 4 router admin mount chồng ⇒ request khớp router thứ 4 phải chạy `requireAuth` **4 lần**.
- Error handler: chỉ trả `error.message` khi `error.status`, còn lại `"Internal server error"`
  ⇒ **mọi lỗi MySQL thành 500** (không phân biệt 400/409/413).
- `/uploads` serve `src/uploads` (**không tồn tại**) trong khi file được ghi vào `backend-node/uploads`
  ⇒ ảnh upload qua admin 404 (hiện ẩn vì seed dùng URL Wikimedia).

### 3.3 Config (`src/config/security.config.js`, 127 dòng)

- `JWT_ACCESS_SECRET` bắt buộc; production phải ≥32 ký tự và không khớp mẫu demo.
- `MFA_ENCRYPTION_KEY` bắt buộc ở production (base64 đúng 32 byte); dev suy ra `sha256("development-mfa:"+secret)`.
- `FRONTEND_ORIGIN` tách phẩy + validate protocol — nhưng **default localhost được gán trước khi check rỗng**
  nên nhánh throw "required in production" là dead code.
- Toàn bộ TTL/limit đọc env, `Object.freeze`.
- `MFA_ISSUER` default `"MovieHub"` trong khi `.env` đặt `Zflix`.

### 3.4 Log bảo mật (`core/security/security-logger.js`, 89 dòng)

Allow-list **26 event**, chỉ ghi field cho phép (`userId, sessionId, targetSessionId, ip, userAgent,
reason, factor, revokedCount`), cắt độ dài; sink chain console + DB; sink lỗi không làm hỏng auth.
Có test chứng minh không lộ password/token (`test/security-logger.test.js`).

**Giới hạn**: không có event cho hành động admin; bảng `security_events` **không có**
`target_session_id`/`revoked_count` ⇒ 2 field này chỉ nằm ở console.

### 3.5 Tiện ích

`asyncHandler`, `parsePositiveInt` (throw 400), `clampPagination` (limit ≤50, default 12);
6 rate limiter **chỉ dùng cho auth**; `business-auth.bridge.js` là shim lịch sử (fallback 503 hiện là
dead code vì `auth.middleware.js` tồn tại); `core/**/Test.js` (5 file 1 dòng) là rác.

---

## 4. Auth & Security (module lớn nhất)

### 4.1 Thành phần

| File | Dòng | Vai trò |
| --- | --- | --- |
| `auth.service.js` | 872 | 20 export: session, refresh rotation, MFA, reset password, login lock |
| `auth.routes.js` | 565 | 18 endpoint + validate + 6 limiter + Origin guard |
| `mfa.js` | 73 | TOTP (otpauth), AES-256-GCM, recovery code |
| `auth-cleanup.js` | 56 | 4 DELETE retention (chỉ chạy tay) |
| `password-reset-delivery.js` | 26 | Dev: giữ token trong RAM; prod: **luôn throw** |
| `core/middleware/auth.middleware.js` | 72 | `requireAuth` (JWT + session DB), `requireRole` |
| `core/security/security-logger.js` | 89 | Allow-list event |

### 4.2 Endpoint (18)

| Method | Path | Guard | Kết quả |
| --- | --- | --- | --- |
| POST | `/register` | Origin + 5/15m | 201; 400; 409 trùng |
| POST | `/login` | 10/15m | 200 + cookie; **202 MFA**; 401; 429 khi lock |
| POST | `/mfa/setup` | auth + Origin + 20/5m | `{secret, otpauthUrl}`; 409 nếu đã bật |
| GET | `/mfa/status` | auth | `{enabled, enabledAt, recoveryCodesRemaining}` |
| POST | `/mfa/enable` | auth + Origin + 20/5m | `{recoveryCodes[10]}`, revoke mọi session |
| POST | `/mfa/verify` | Origin + 20/5m | 200 + cookie (bước 2) |
| POST | `/mfa/disable` | auth + Origin + 20/5m | revoke mọi session |
| POST | `/mfa/recovery-codes/regenerate` | auth + Origin + 20/5m | `{recoveryCodes}` |
| POST | `/refresh-token` | Origin + 120/15m | access mới + cookie mới (rotation) |
| POST | `/change-password` | auth + Origin, **không limiter** | revoke mọi session |
| POST | `/forgot-password` | 5/15m | 200 generic |
| POST | `/reset-password` | 10/15m | revoke mọi session |
| POST | `/logout` | Origin, **không auth** | 204 |
| GET | `/sessions` | auth | danh sách phiên, đánh dấu `current` |
| DELETE | `/sessions/:id` | auth + Origin | 204 / 404 |
| POST | `/logout-others`, `/logout-all` | auth + Origin | 204 |
| GET | `/me` | auth | `{user}` từ DB |

### 4.3 Luồng then chốt

- **Login**: tra email → `status/locked` check **trước** bcrypt → bcrypt → sai thì tăng counter + set lock
  (SQL IF lồng, MySQL eval trái→phải nên lock đúng lần sai thứ 5) → đúng thì reset;
  nếu MFA bật: vô hiệu challenge cũ, tạo challenge 32B (SHA-256, TTL 300s, 5 lần) và trả **202, chưa cấp token**.
- **Refresh rotation**: tra theo hash; absolute hết hạn hoặc user bị disable ⇒ **revoke session**;
  idle hết hạn ⇒ 401 (không revoke); UPDATE atomic `WHERE refresh_token_hash = <cũ>` + `LEAST(now+7d, absolute)`
  ⇒ chống replay. **Không** có phát hiện reuse theo family, không alert.
- **MFA**: secret 20B mã hoá AES-256-GCM (iv 12/tag 16); TOTP SHA1/6 số/30s, cửa sổ ±1;
  chống replay bằng `mfa_last_used_step` (UPDATE có điều kiện `< step`); recovery code 10 mã 128-bit,
  tiêu thụ với `FOR UPDATE`; enable/disable **revoke toàn bộ session**.
- **Reset password**: token 32B, SHA-256, TTL 30 phút, one-time (`FOR UPDATE` + claim có điều kiện),
  đổi xong revoke mọi token + mọi session.

### 4.4 Cookie & bề mặt tấn công

Cookie `refreshToken`: `httpOnly`, `secure = isProduction`, `SameSite=Lax`, `path=/api/v1/auth`, 7 ngày.
Với `.env` hiện tại (`NODE_ENV=production`) cookie là `Secure` trên HTTP — chỉ chạy được nhờ ngoại lệ
"localhost tin cậy" của trình duyệt.

Điểm yếu đáng kể:

1. **Timing oracle**: email không tồn tại trả về **trước** bcrypt (`auth.service.js:105`) ⇒ dò email được.
2. **Enumeration + account DoS**: `/register` trả 409 khi trùng; lock trả 429 ⇒ kẻ tấn công khoá được
   tài khoản nạn nhân (5 lần sai/5 phút).
3. **`/change-password` không rate limit** ⇒ brute-force mật khẩu hiện tại bằng access token bị đánh cắp.
4. **MFA attempt cap reset bằng login lại**: mỗi login tạo challenge mới (5 lần/challenge × 10 login/15m).
5. **Không reuse detection** cho refresh token; replay chỉ 401, session không bị revoke.
6. **Log amplification**: mọi request thiếu token ghi 1 INSERT `security_events` (pool 10) ⇒ flood dễ.
7. **Rate limit per-IP, không `trust proxy`** ⇒ sau reverse proxy dùng chung 1 bucket; login thành công vẫn bị tính.
8. **`decryptTotpSecret` không bắt lỗi** ⇒ xoay `MFA_ENCRYPTION_KEY` = 500 khi login MFA và **không thể disable MFA**.
9. **Forgot-password no-op ở production** (chưa có email provider) nhưng vẫn log `PASSWORD_RESET_REQUESTED`.
10. **Thiếu `Cache-Control: no-store`** ở `/login` 200, `/refresh-token`, `/me` (chỉ nhánh 202 và route MFA có set).
11. Rate limit và cleanup: cleanup chỉ chạy tay (`npm run cleanup:auth`), 4 DELETE không LIMIT,
    `absolute_expires_at` không index, `security_events` **không bao giờ** được prune.
12. `console.error(error)` có thể in cả object lỗi mysql2 (kèm SQL/bind values).

### 4.5 Test

`test/app.test.js` (210 dòng) phủ health/validate/401/403/JWT allow-list/Origin/429/production secret
(bằng spawn process con); `mfa.test.js` phủ enrollment + RFC6238 + recovery code; `security-logger.test.js`
phủ allow-list. Integration: auth 542, mfa 475, password-lifecycle 306, cleanup 144, registration 91 dòng —
cần DB thật. **Không** có test cho watch-party/community/streaming/admin/shopping/visual.

---

## 5. Discovery / Community / Streaming

### 5.1 Discovery (6 endpoint)

`/filters` (3 query song song), `/productions` (search + filter + `clampPagination`),
`/productions/suggest` (LIKE `q%` LIMIT 8, cắt 80 ký tự), `/productions/:id` (chi tiết +
`GROUP_CONCAT` genres + episodes), `POST /search/reindex` (**admin**, trùng với admin),
`POST /productions/:id/episodes` (**admin**, transaction + `FOR UPDATE` + tự tạo notification cho
`production_interests`).

Search: ES `multi_match(title^3, description, genres, fuzziness AUTO, operator and)` +
`bool.filter` genre/country/year/minRating + sort + from/size. **Sort đặt `release_year` trước `_score`**
⇒ relevance gần như vô hiệu. ES `total` bị chặn 10.000 ⇒ `pages` sai với catalog lớn.
Fallback MySQL (`LIKE %..%`) khác ES ở 8 điểm (không tìm trong genres, đòi nguyên cụm, không fuzzy,
MySQL bỏ dấu tiếng Việt, `rating_avg` trả string, `total` chính xác…). Sync **upsert-only, không xoá doc**,
không reindex khi rating/admin sửa phim, lỗi bị nuốt (`return 0`) và `_bulk` trả 200 dù item lỗi.

Lỗi cụ thể: `minRating="abc"` lọt validate (`NaN` so sánh đều false) → ES 400 → fallback lỗi;
`GROUP_CONCAT` mặc định 1024 byte ⇒ genres bị cắt cụt; `productions` **không có index `title`**
⇒ suggest full scan.

### 5.2 Community (16 endpoint)

- Favorites/Interests: PUT upsert (không phải toggle), DELETE 204; `notify_new_episode` **hard-code 0**.
- Rating: 1 user 1 rating/phim (PK), PUT + recalc `rating_avg/count` trong transaction — **nhưng trigger
  `after_rating_*` đã recalc trước đó** ⇒ tính 2 lần/request. **Bug mất dữ liệu**: client chỉ gửi `{rating}`
  (`MovieDetailPage.jsx:52`) mà SQL `review_title=VALUES(review_title)` ⇒ **review cũ bị ghi NULL** mỗi lần đổi sao.
- Comment: 1 cấp `parent_id`, không giới hạn độ sâu, soft delete `[Đã xóa]`; **không có like**
  (`comment_likes` + `likes_count` bị bỏ rơi, chỉ đọc ra).
- Notification: GET 100 gần nhất; `unread` **chỉ đếm trong 100 row** ⇒ sai khi >100. Không notify khi có
  comment/rating mới (enum `reply|like` là giá trị chết).
- Dùng `affectedRows` thay `changedRows` ⇒ PATCH comment/notification không đổi nội dung trả **404**.
- Không phân trang ở bất kỳ list nào; express 5 không body ⇒ `req.body.rating` ném TypeError → **500**.

### 5.3 Streaming (5 endpoint)

- `GET /episodes/:id` **public, trả cả `video_url`**; `GET /productions/:id` cũng trả `episodes[].video_url`
  ⇒ **paywall không tồn tại**, phim `is_premium` xem được không cần đăng nhập.
- `PUT /history/:episodeId`: kẹp position vào `[0, duration]`, `watched_percent`, `completed >= 90%`,
  upsert; `last_position` **cho lùi**, `is_completed` bị ghi đè ⇒ mất trạng thái hoàn thành;
  payload lặp y hệt ⇒ `last_watched_at` không đổi (ON UPDATE) ⇒ thứ tự "xem tiếp" sai.
- Trigger `IncrementEpisodeView` chỉ chạy khi INSERT thật ⇒ `views_count` +1 duy nhất lần đầu.
- FE **không đọc** `/history` để seek ⇒ tính năng resume chưa nối.

---

## 6. Watch Party (REST 13 + Socket.IO không auth)

### 6.1 REST

Tạo phòng (title, episodeId, password?, max 2..50) → ID 8 hex → INSERT `watch_parties` (`waiting`, +24h)
→ INSERT host participant. Join kiểm password **plaintext** (`!==`), đếm participant (**TOCTOU**),
upsert, ghi system chat. Leave: host → `ended`; khác → xoá row. Playback/status: host/co-host/cờ
`can_control_playback`. Chat REST kiểm mute/allow_chat/ended. Participant management **chỉ host**
(mute/promote/demote/kick). Settings host đổi `allowChat/title/maxParticipants`.

- `GET /watch-party-users` **public** trả `email` của 10 user ⇒ **lộ PII**.
- `GET /watch-party/:partyId` **public** trả chat 100 tin + participants ⇒ đọc phòng có mật khẩu không cần join.
- `GET /watch-party/my-parties` khai báo **sau** `/:partyId` ⇒ **luôn 404**.
- Password phòng lưu **plaintext** (`varchar(100)`), seed cũng plaintext ('stranger123').

### 6.2 Socket (`watch-party.socket.js`, 263 dòng)

- Không `io.use`, không kiểm cookie/JWT; danh tính lấy từ payload `join-party {userId, username, avatarUrl}`.
- Events: `join-party, leave-party, chat-message, sync-playback, request-sync, participant-action, end-party`
  → `error, party-joined, party-left, new-chat, playback-sync, participant-updated, party-ended`.
- **P0**: `participant-action` **không kiểm quyền** ⇒ ai trong room cũng kick được người khác;
  `join-party` bỏ qua password/sức chứa ⇒ vào phòng riêng tư đọc chat/playback; `sync-playback`/`end-party`
  tra DB theo `socket.data.userId` (giả mạo) ⇒ chiếm quyền host.
- `end-party` không đuổi socket; sau đó `sync-playback` vẫn set `status='playing'` ⇒ **hồi sinh phòng đã kết thúc**.
- Không rate limit, không ack/sequence, client không rejoin sau reconnect, không xử lý `error`.

### 6.3 Vòng đời

DB là source of truth; RAM chỉ giữ room + `socket.data`. **Không cleanup**: phòng rỗng/hết hạn
(`expires_at` không enforce) vẫn hiện trong list; host disconnect không chuyển host, không đóng phòng.

---

## 7. Admin (4 router, 31 endpoint)

### 7.1 Ghép nối & phân quyền

Mount nối tiếp `admin → content → moderation → system` cùng `/api/v1/admin`; **mỗi router tự
`requireAuth`** (2–4 lần SELECT session/request). Mỗi file tự định nghĩa `requireAdmin`/`requireStaff`
(**4 bản trùng lặp**), **không dùng `requireRole`** có sẵn ⇒ 403 admin **không được log**.

| Nhóm | Endpoint |
| --- | --- |
| admin + moderator | `/stats`, `/productions` GET/PATCH, `/views`, productions CRUD (tạo/sửa), episodes (list/add/patch), `/parties` GET + end, `/comments` GET/DELETE, `/ratings` GET/DELETE, `/notifications/broadcast`, `/search/reindex` |
| admin only | `/users` GET/PATCH, xoá production/episode, xoá party, `/subscriptions`, grant VIP, `/security-events`, `/export/*.csv`, `/settings/featured` |

### 7.2 Nghiệp vụ & lỗi

- `/stats`: 9 query song song (9/10 connection), không transaction; `daily_stats` **không có writer**
  ⇒ dashboard đứng yên với seed; `rating_avg` lấy từ `ratings` (trigger) khác `productions.rating_avg`.
- Users: chặn tự đổi role/tự khoá nhưng **không chặn xoá admin cuối**; API chỉ set `user|admin`
  ⇒ không tạo được moderator dù enum có; khoá user **không revoke session**.
- Content: slug NFD **mất chữ "đ"** + hậu tố `Date.now()` (trùng ms → 500); `Boolean("false")=true`;
  chỉ cho `movie|series` (không tạo `season`); PUT genres `DELETE+INSERT` không `ON DUPLICATE` ⇒ trùng = 500.
- Xoá phim/tập: nhánh 409 `ER_ROW_IS_REFERENCED_2` là **dead code** (mọi FK CASCADE/SET NULL)
  ⇒ **xoá cascade im lặng** episodes/history/ratings/comments/bookmarks/parties.
- Comment: chỉ hard DELETE (cascade reply + likes); **không có** ẩn/duyệt dù enum có `hidden`.
- Broadcast: 1 câu `INSERT..SELECT` toàn bộ user active, không batch/audit.
- Party: `PATCH /end` chỉ UPDATE status, **không phát socket** ⇒ client vẫn phát; DELETE tự xoá chats/participants.
- Analytics: 30 ngày `ORDER BY stat_date ASC LIMIT 30` ⇒ **30 ngày cũ nhất**; doanh thu
  `GROUP BY DATE_FORMAT(vip_end_date)` ⇒ gom theo tháng **hết hạn**, không phải tháng mua.
- Grant VIP: đọc user/plan **ngoài transaction**, không `FOR UPDATE` (mất ngày); thiếu `planId` ⇒
  `transactions.plan_id NOT NULL` ⇒ **500**; `days` bỏ qua `plan.duration_days`; `payment_method`
  hardcode `credit_card`; không đóng subscription cũ ⇒ nhiều bản ghi `active`.
- Featured: không kiểm tra phim còn tồn tại ⇒ banner trỏ id chết; `app_settings` **không seed**.
- Export CSV: full scan, không limit/audit, có PII, **rủi ro CSV formula injection**.

### 7.3 Audit

`security_events` chỉ có `(event,user_id,session_id,ip,user_agent,reason,factor)` — không actor/action/
entity/before-after; allow-list **không có event admin** ⇒ không trả lời được "ai đổi role / grant VIP /
xoá phim". Đề xuất `admin_actions` hoặc mở rộng logger + dùng `requireRole`.

---

## 8. Shopping & Visual Shopping (CLIP + HNSW + OCR)

### 8.1 Kiến trúc

- CLIP **ViT-B/32** qua Transformers.js 2.17.2 (ONNX Runtime), bản **quantized 89,1 MB**
  (`backend-node/models/Xenova/.../vision_model_quantized.onnx`), load **lazy** ở request đầu,
  `numThreads=2`; `allowLocalModels=false` ⇒ phụ thuộc cache/tokenizer (offline không đảm bảo).
- HNSW in-process (`hnswlib-node`): 512 chiều, **cosine**, `M=16`, `efConstruction=200`,
  `efSearch` **không set** (mặc định 10), `maxElements = max(1000, 2N)`, **label = product id**
  ⇒ id > maxElements làm `addPoint` throw và rebuild hỏng vĩnh viễn. Index **chỉ trong RAM**,
  rebuild lazy lần search đầu + auto-heal + sau khi thêm/xoá sản phẩm.
- OCR Tesseract.js **chỉ model `eng`** trên nội dung tiếng Việt ⇒ keyword rác ("WRI", "BRT", "FON")
  vẫn được dùng làm `ai_keyword` và link Shopee. 1 worker dùng chung, tuần tự, **không timeout**.
- Vision LLM (Gemini/SerpAPI) chỉ dùng ở `/shopping/match` (không nằm trong pipeline `/scan`).

### 8.2 Hiệu năng thật (từ `visual_searches`, 56 request)

`embed` trung bình 70,9 ms (max 102) · `search` 0,11 ms · `rank` 0,05 ms · **tổng 459 ms** (max 2.925 ms).
22 request có OCR text: **853 ms**; 34 request không có: 205 ms. 7/56 trả 0 kết quả (ngưỡng 0,6).
`docs/benchmark-visual-search.md` ghi "40 ms" vì chỉ đo embed+search, bỏ crop/OCR/DB/rank; "Top-1 100%"
là self-query trên 11 sản phẩm với k=5 (production k=20).

### 8.3 Lỗi/lỗ hổng

1. **`/scan` và `/visual-search` không auth** ⇒ `req.user` luôn undefined, 100% `visual_searches.user_id`
   là NULL; limiter theo user chết.
2. **Sai đường dẫn static** (`src/uploads` vs `backend-node/uploads`) ⇒ ảnh catalog admin 404;
   SerpAPI `PUBLIC_BASE_URL` cũng sai.
3. **CSV import không tạo embedding** nhưng vẫn rebuild index ⇒ sản phẩm import **không bao giờ** tìm được;
   parser CSV tự viết (không dùng `csv.js`), không transaction/upsert.
4. `rebuildIndex` không `.catch` reset promise ⇒ 1 lần lỗi làm **mọi search sau đó 500** tới khi restart.
5. **Blocking event loop**: `searchKnn` sync, `addPoint` sync khi rebuild, `writeFileSync` ~3 MB, parse JSON
   toàn catalog; không queue/semaphore.
6. `/visual-search/stats` public nhưng gọi `clipReady()` + build index ⇒ ai cũng trigger load 89 MB;
   `POST /visual-search` parse 5 MB **trước** rate limit ⇒ DoS rẻ.
7. **Không `trust proxy`** ⇒ mọi user chung bucket IP (30/15') và express-rate-limit v8 có thể ném
   `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` sau proxy.
8. **Affiliate không gắn `tracking_id` vào URL đích** ⇒ không đối soát được với sàn; redirect public
   không dedupe/rate limit ⇒ bơm click; `searchId` không kiểm ownership; click lưu `search_id` NULL.
9. **Whitelist redirect thiếu `track.accesstrade.vn`** ⇒ affiliate ACCESSTRADE bị 409.
10. **SerpAPI upload ảnh user lên tmpfiles.org public 60 phút** ⇒ rò rỉ dữ liệu người dùng.
11. Gemini model default `"gemini-3.8-flash"` (gần như chắc chắn không tồn tại) ⇒ fallback im lặng;
    key đi trong query string và có thể lọt vào `console.warn`.
12. **Prompt injection**: text trong ảnh điều khiển JSON keyword; `parseGeminiResponse` nhận cả text ≤60 ký tự.
13. `/scan` trả `detail: error.message` ⇒ lộ path/model; multer lỗi file quá lớn rơi vào handler chung ⇒ 500.
14. Uploads tích 13 file rác (`embed-tmp-*`) — không cleanup, không quota.

---

## 9. Frontend người dùng

### 9.1 Route map (18 route)

| Path | Component | Guard |
| --- | --- | --- |
| `/` | HomePage | public |
| `/movies/:id` | MovieDetailPage | public |
| `/watch/:episodeId` | PlayerPage (+ CineLens) | public |
| `/watch-party` | PartyList | public |
| `/library`, `/history`, `/notifications` | Library/History/Notifications | đăng nhập |
| `/watch-party/create`, `/watch-party/room/:partyId` | CreateParty, PartyRoom | đăng nhập |
| `/account/security` | AccountSecurityPage | đăng nhập |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/admin-login` | các trang auth | public |
| `/admin` (+7 trang con) | AdminPage + pages | admin/mod |

Guard 2 tầng lồng nhau: `["admin","moderator"]` rồi `["admin"]` cho users/subscriptions/security/settings.
**Không có** `errorElement`/ErrorBoundary/route 404 ⇒ một lỗi render là trắng trang.

### 9.2 Auth client

- `accessToken` **chỉ trong biến module** (`api.js:3`), mất khi reload; refresh token trong cookie httpOnly.
- `apiRequest` gắn Bearer → 401 thì `refreshSession()` (single-flight bằng `pendingRefresh`) rồi retry **1 lần**.
- Không axios interceptor (axios có trong `package.json` nhưng **không dùng**); không timeout/AbortSignal;
  refresh lỗi thay mất `error.status` gốc.
- `AuthContext` bootstrap bằng `refreshSession()`; `adminLogin` **chỉ chấp nhận `role === "admin"`**
  ⇒ moderator không đăng nhập được ở `/admin-login` (mâu thuẫn route cho moderator).
- `ProtectedRoute`: loading → text; chưa đăng nhập → `/login` + `state.from`; sai role → về `/` (không có 403).

### 9.3 Thành phần & hành vi

- **HomePage**: filters tách `draft`/`filters`, debounce suggest 250 ms; không UI phân trang dù có `pages`;
  bug: "Xóa lọc" gán lại cùng tham chiếu ⇒ React bail-out ⇒ `loading` kẹt `true`.
- **MovieDetailPage**: 1 khối JSX lớn; `movie.episodes.map` crash nếu API thiếu episodes; action chung cho
  favorite/interest/rating/comment; gửi rating **chỉ `{rating}`** ⇒ backend ghi đè review = NULL (bug P1).
- **Library/History/Notifications**: mỗi file 11–14 dòng, **không loading, không empty**, async onClick
  không `.catch` (unhandled rejection).
- **AccountSecurityPage** (502 dòng): đổi mật khẩu, bật/tắt MFA + QR (`qrcode.react`), recovery code có
  checkbox xác nhận, danh sách phiên + thu hồi từng phần/others/all.
- **PartyRoom** (693 dòng): nguồn dữ liệu thật là **socket**, không phải REST; `isHost` suy từ mảng
  participants; mute/kick/promote gọi REST rồi emit socket **rồi `loadRoomData()`** ⇒ **unmount video,
  cả phòng mất vị trí phát**; viewer vẫn có `controls`; `isLocalSeeking` là dead flag ⇒ ping-pong seek.
- **PlayerPage + CineLens**: Lensy → chọn vùng → `captureVideoRegion` (canvas → JPEG 0.8) → `POST /scan`
  → ProductPanel. `cropMs` hardcode 0; **crop lệch ~16 px** vì video có `margin-top:1rem` còn overlay
  phủ `.player-stage`; không `setPointerCapture` ⇒ kẹt khi thả chuột ngoài overlay; không `touch-action`
  ⇒ không chọn được trên mobile; slider "vị trí xem thử" không seek video; `window.__lensyDebug` còn sót.
- **Style**: Tailwind 4 (`@theme` token đỏ/đen) + 150 dòng CSS thủ công cho App/Home/…; antd **chỉ**
  trong admin và **không** có `ConfigProvider`/dark theme. Xung đột cascade: `.app button/input` nằm
  **ngoài** `@layer` nên đè utility Tailwind (nút watch-party bị "nhuộm đỏ").
- **Chết**: `Navbar.jsx` (103 dòng, branding "Module by Khoa"), `Logo.jsx`, 7 `Test.jsx`, 4 hàm API,
  `x-user-id` client gửi mọi request (backend **bỏ qua**).

---

## 10. Frontend admin

### 10.1 Khung (AdminPage.jsx, 245 dòng)

- antd `Layout` + `Sider` dark 230 px (collapsed 80) + `Menu` + `Header` có `Dropdown` (về trang người
  dùng / đăng xuất) + `Content` trắng bo góc. **Không** `ConfigProvider`/`theme.darkAlgorithm`/locale VI
  ⇒ antd dùng theme sáng mặc định, trộn với Tailwind slate của các trang con.
- Vào `/admin` gọi **`GET /api/v1/admin/check`** và có 3 trạng thái: `checking` / `allowed` /
  `denied|error` (màn hình chặn riêng). Đây là lớp kiểm tra **thứ hai** sau `ProtectedRoute`.
- Menu lọc theo `user.role`: 6 mục cho moderator (Tổng quan, Phim, Cộng đồng, Party, Shopping, Lượt xem),
  thêm 4 mục **chỉ admin** (Người dùng, VIP & Doanh thu, Nhật ký bảo mật, Cài đặt).
- `MemoizedHeader`/`MemoizedContent` bọc `memo`; `getActiveMenuKey` map segment cuối → key menu
  (`/admin` → `analytics`).

### 10.2 Trang → API

| Trang | API dùng |
| --- | --- |
| Tổng quan (`DashboardPage`) | `GET /admin/stats` |
| Quản lý phim (`MoviesAdminPage`, 458 dòng) | `GET /admin/productions`, `GET /admin/productions/:id`, episodes `GET/POST/PATCH/DELETE`, `PUT/POST/DELETE /admin/productions`, `PATCH` (is_premium/status), `POST /admin/search/reindex`, `GET /filters` |
| Cộng đồng (`CommunityAdminPage`) | `GET/DELETE /admin/comments`, `GET/DELETE /admin/ratings/:userId/:productionId`, `POST /admin/notifications/broadcast` |
| Watch Party (`PartiesAdminPage`) | `GET /admin/parties`, `PATCH /admin/parties/:id/end`, `DELETE /admin/parties/:id` |
| Mua sắm (`ShoppingAdminPage`) | `GET/POST/DELETE /shopping/admin/products`, `GET /shopping/admin/snapshots`, `GET /admin/productions` |
| Lượt xem (`ViewsPage`) | `GET /admin/views` |
| Người dùng (`UsersAdminPage`, 190 dòng) | `GET /admin/users?page&limit&search`, `PATCH /admin/users/:id` (role, status) |
| VIP & Doanh thu (`SubscriptionsAdminPage`, 186 dòng) | `GET /admin/subscriptions` (2 lần), `GET /admin/users?search&limit=5`, `POST /admin/users/:id/vip` |
| Nhật ký (`SecurityAdminPage`) | `GET /admin/security-events?…` |
| Cài đặt (`SettingsAdminPage`) | `GET /admin/productions?limit=50`, `GET/PUT /admin/settings/featured`, `fetch('/api/v1/admin/export/{users|transactions}.csv')` |

### 10.3 Hành vi & lỗi cụ thể

- **Người dùng**: select có 3 lựa chọn `user | moderator | admin` (`UsersAdminPage.jsx:137-139`)
  nhưng backend chỉ nhận `user|admin` ⇒ chọn **moderator trả 400**, UI hiện lỗi. Chặn tự thao tác
  (`isSelf`) khớp guard backend; đổi role/khoá xong `load()` lại (không optimistic).
- **VIP**: form gửi `{days, planId: planId ? Number(planId) : null}` (`SubscriptionsAdminPage.jsx:41-44`)
  ⇒ chọn "Không theo gói" gửi `planId: null` xuống backend có `transactions.plan_id NOT NULL`
  ⇒ **500** (khớp lỗi backend). `days` do admin gõ tay, độc lập với `plan.duration_days`.
- **Cài đặt**: nút export CSV dùng `fetch` **URL tương đối** (`/api/v1/admin/export/...`, `:49`)
  không kèm `Authorization` và Vite **không proxy** ⇒ request đi tới `:5173` ⇒ **export CSV hỏng**
  (404). Đây là lỗi P1 chỉ thấy khi bấm nút.
- **Phim**: đổi `status` bằng `<select>` PATCH ngay khi `onChange`, **không confirm**; toggle VIP,
  thêm/sửa phim qua modal; các `apiRequest(...).then(load).catch(setError)` không chặn double-click.
- **Cộng đồng/Party**: mutation gọi API rồi load lại; xoá comment/party không có undo.
- **Không có** phân quyền phía client cho từng nút (ví dụ nút broadcast nằm trong router của moderator)
  — đúng với backend cho phép moderator broadcast, nhưng trái chủ đích "system = admin only" của doc.
- **Rủi ro render**: `AdminPage` dùng `user.username` không guard; nếu session mất đúng lúc đang ở
  `/admin`, `ProtectedRoute` sẽ redirect nhưng trong 1 nhịp render có thể ném TypeError.
- Chỉ trang Người dùng/VIP/Cài đặt được đọc kỹ từng dòng; các trang còn lại mô tả theo API + route
  (chưa rà từng nhánh UI).

## 11. Database

### 11.1 Thực tế

- `database/init.sql` là **dump MySQL 8.0.44**: **32 bảng, 282 cột, 42 FK, 13 cột enum, 4 trigger,
  2 procedure, 0 view**; seed **902 dòng/23 bảng**, 9 bảng rỗng. **Không** có `CREATE DATABASE/USE`.
- Chạy **đủ** 5 file `database/*.sql` → **35 bảng** (thêm `visual_products`, `visual_searches`,
  `affiliate_clicks`) và DB đang chạy **đúng 35 bảng**.
- `init.sql` **destructive**: mỗi bảng `DROP TABLE IF EXISTS`; `ALTER TABLE users` không guard ⇒
  chạy lại mất dữ liệu / lỗi 1060 nếu bảng đã có cột.
- 100% InnoDB + `utf8mb4_unicode_ci`; 1 `JSON`, 1 `FULLTEXT` (actors), 2 index `DESC`, 1 `CHECK`.
- 4 FK `SET NULL`, còn lại 38 `CASCADE`; **không** FK nào RESTRICT. `users` là hub 16 FK;
  `productions` 10 FK ⇒ xoá là cascade dây chuyền.

### 11.2 Dữ liệu đang có (kiểm tra trực tiếp)

| Bảng | Số dòng | Ghi chú |
| --- | --- | --- |
| users | 51 | 50 `user` + **1 `admin`**, **0 moderator**; admin@moviehub.com (mfa_enabled=0) |
| productions | 228 | 58 `series` + movies/seasons; `movies` **0 dòng** (bảng chết) |
| episodes | 1.125 | seed gốc 55 tập, phần lớn thêm từ OMDb seed |
| series / genres | 58 / 20 | — |
| comments / ratings | 1 / 0 | gần như trống |
| watch_history | 3 | — |
| watch_parties / chats | 4 / 11 | — |
| security_events | 218 | tích từ các lần đăng nhập |
| auth_sessions | 66 | — |
| visual_products / visual_searches | 11 / 56 | affiliate_clicks: 8 |
| production_products / snapshots | 5 / 7 | — |
| transactions / user_subscriptions / daily_stats | 0 / 0 / 0 | **doanh thu & thống kê trống** |
| bookmarks / interests / notifications | 0 / 0 / 0 | — |

### 11.3 Seed & tài khoản

- **44 user local dùng chung một hash bcrypt** (cost 12) — plaintext không có trong repo;
  6 user `provider='google'` có password NULL. Sau này dùng `npm run db:password` để đặt lại
  (xem [SETUP_TEAM.md](SETUP_TEAM.md)); muốn tự làm thì `UPDATE users SET password=<hash mới>`.
- Toàn bộ `episodes.video_url` seed = `https://vjs.zencdn.net/v/oceans.mp4` (~8 phút) nhưng `duration`
  khai 7.500–11.940 giây ⇒ progress bar/`watched_percent` sai ngay từ dữ liệu.
- `watch_parties.password` seed lưu **plaintext**.
- `app_settings` **không seed** ⇒ banner trang chủ luôn null trên DB mới.

### 11.4 Index

**Thiếu cho truy vấn nóng**: `productions(title,description)` FULLTEXT (search fallback đang `LIKE '%…%'`),
`comments(production_id,status,created_at)`, `notifications(user_id,created_at)`,
`ratings(production_id,updated_at)`, `production_interests(user_id,created_at)`,
`production_products(production_id,timestamp_start)`, `security_events(event,created_at)`.
**Dư**: index trùng unique (`users.idx_email`, `genres.idx_slug`, `productions.idx_slug`,
`transactions.idx_transaction_code`, `episodes.idx_production`, `daily_stats.idx_stat_date`).

### 11.5 Migrations & drift

| File | Nội dung | Drift |
| --- | --- | --- |
| `database/migrate-hai.sql` | `production_interests` | khớp init.sql |
| `database/migrate-ngoc.sql` | `security_events`, `app_settings`, `role` + moderator | khớp |
| `database/migrate-shopping.sql` | 2 bảng + FK `pp_production_ibfk_1` | init.sql **thiếu FK** |
| `database/migrate-visual-shopping.sql` | 3 bảng + FK | 3 bảng **không có** trong init.sql |
| `backend-node/migrations/*.sql` (3 file) | auth phase 1B/3/4A | **không script nào tham chiếu** — artifact chết; thứ thực chạy là `npm run migrate:auth` (DDL inline) |

⇒ **Không thể dựng DB chỉ bằng migrations**; import tay chỉ `init.sql` (như README) sẽ **thiếu 3 bảng
visual** ⇒ module visual-shopping chết (1146).

### 11.6 Docker vs XAMPP

`docker-compose.yml` (114 dòng): 6 service (db, elasticsearch, backend-node, 2 python, frontend),
volume `db_data`/`elastic_data`, mount `./database` vào `initdb.d` (chạy cả 5 file theo alphabet).
Vấn đề: **dev-only** nhưng `DEPLOYMENT.md` gọi "production-ready"; backend chạy `npm install && npm run dev`
(nodemon); mật khẩu DB hardcode `rootpassword`; không healthcheck app; **3306 xung đột XAMPP**;
MariaDB < 10.8 không hiểu `utf8mb4_0900_ai_ci` (session-level) và index `DESC`.
README giải thích sai lý do phải `sed` (bảng thực tế dùng `unicode_ci`, chỉ session SET dùng `0900_ai_ci`).

---

## 12. Docs, tools, tests, Prisma

- **Prisma chết**: `prisma/schema.prisma` 14 dòng, **0 model**, datasource **postgresql**;
  `prisma.config.ts` trỏ `prisma/migrations` (không tồn tại); `prisma`/`@prisma/client` **không có**
  trong `package.json`/lockfile/node_modules; **0 import** trong `src`. ERD trong docs không tái tạo được.
- `tools/generate-prisma-erd.mjs` (233 dòng): parse regex `model X {` (schema rỗng ⇒ SVG rỗng), toạ độ
  và 34 quan hệ **hardcode 22 bảng**, có bảng **`comment_reactions` không tồn tại** trong DB.
- **Tests**: unit 8 file (app 210, mfa 51, security-logger 62, search 42, visual-shopping 66, vision 35,
  schema-consistency 33, ocr-color 17) + integration 5 file (1.558 dòng). Test backend **import cả code
  frontend** (`test/visual-shopping.test.js:7` → `frontend/src/utils/cropMath.js`).
  Không test watch-party/community/streaming/admin/shopping.
- **Docs**: `AUTH_SECURITY_PROGRESS.md` (324 dòng, 7 phase) là tài liệu auth chuẩn nhưng đã cũ;
  `project-analysis/README.md` (1.090 dòng) mô tả Prisma 21 model + bảng `comment_reactions` **không có thật**;
  `HAI_API_REFERENCE/MODULES_GUIDE` mô tả API discovery/community/streaming (thiếu `/productions/suggest`);
  `HAI_TEST_REPORT` nói API trả 503 `AUTH_MODULE_NOT_INTEGRATED` (không còn đúng); `DEPLOYMENT.md` nói
  docker-compose production-ready (thực tế dev-only).

---

## 13. Tài liệu vs code: các lệch quan trọng

| Tài liệu nói | Thực tế |
| --- | --- |
| README: init.sql = **28 bảng**; DEPLOYMENT: **30 bảng**; project-analysis: **21 model Prisma** | **32 bảng** trong init.sql, **35** khi chạy đủ; Prisma **0 model** |
| project-analysis: có model/bảng `comment_reactions`, `dislikes_count`, `is_spoiler`, Prisma 5.22 | Không tồn tại; bảng thật là `comment_likes`; Prisma không có trong dependency |
| `AUTH_SECURITY_PROGRESS.md:240-252`: favorites/history/comments/ratings/watch-party/admin CRUD "**chưa triển khai**" | Tất cả **đã có** API thật (16+5+13+31 endpoint) ⇒ kết luận "không phát hiện security bug" của Phase 7 **hết hiệu lực** |
| `AUTH_SECURITY_PROGRESS.md`: doc theo branch `Du`, commit `55430bf` | Branch `integration`, HEAD `1386e14`, lệch ~1 tháng |
| `AUTH_SECURITY_PROGRESS.md:229`: `/admin/check` = `requireRole("admin")` | Inline role `{admin, moderator}` (`app.js:83-93`) |
| README: admin-login cho admin, moderator quản nội dung | `adminLogin` chỉ nhận `role === "admin"` ⇒ moderator **không đăng nhập được** ở trang đó |
| README: "MySQL 8 hoặc MariaDB ≥10.5", chuyển collation vì `0900_ai_ci` trong `init.sql` | Mọi bảng dùng `utf8mb4_unicode_ci`; `0900_ai_ci` chỉ ở `SET collation_connection`; MariaDB cần ≥10.8 vì index `DESC` |
| HAI docs: `GET /episodes/:id` thuộc Discovery; thiếu `/productions/suggest`; 503 `AUTH_MODULE_NOT_INTEGRATED` | Endpoint ở `streaming.routes.js`; suggest có thật và FE dùng; 503 là dead code |
| HAI docs: "backend tự tạo/**cập nhật** index khi khởi động" | Chỉ tạo mapping khi thiếu + upsert; không xoá doc stale, không reindex khi dữ liệu đổi |
| `docs/benchmark-visual-search.md`: 40 ms, 0 ms search, Top-1 100% | Telemetry thật: **459 ms** trung bình (853 ms khi có OCR); Top-1 là self-query 11 sản phẩm |
| `DEPLOYMENT.md:29`: docker-compose "production-ready"; `:81` "0 lỗi API" | compose tự ghi "Development-only"; chạy nodemon + `npm install`; `app_settings` không seed ⇒ banner null |
| `tools/generate-prisma-erd.mjs`: 21 bảng | SVG 22 bảng, schema 0 model |

---

## 14. Danh sách phát hiện (ưu tiên)

### P0 — bảo mật / mất dữ liệu

1. **Socket watch-party không xác thực**: danh tính client tự khai, join bỏ qua mật khẩu/sức chứa,
   `participant-action` không phân quyền ⇒ chiếm phòng, kick người khác, đọc chat phòng riêng tư.
2. **Lộ email user công khai**: `GET /api/v1/watch-party-users`.
3. **Paywall không tồn tại**: `GET /episodes/:id` và `GET /productions/:id` trả `video_url` cho mọi người.
4. **Mật khẩu phòng watch-party lưu plaintext** (cả seed).
5. **Không có audit admin**: 403 admin không log; không log mutation ⇒ không truy vết.
6. **Grant VIP có thể 500** (thiếu `planId`) và **mất ngày** khi chạy song song (thiếu `FOR UPDATE`).
7. **Rating PUT ghi đè review thành NULL** (FE chỉ gửi `{rating}`) ⇒ mất dữ liệu người dùng.
8. **44 tài khoản seed dùng chung 1 hash bcrypt**, không có plaintext ⇒ không thể đăng nhập nếu không reset.

### P1 — chức năng sai / dữ liệu sai

9. **Quên mật khẩu không hoạt động** với `.env` hiện tại (`NODE_ENV=production`, chưa có email provider).
10. **Moderator không đăng nhập được** `/admin-login`.
11. **`my-parties` luôn 404**; **join bằng mã phòng** điều hướng thẳng, không gọi `/join`.
12. **Phòng đã kết thúc "sống lại"**; không cleanup, `expires_at` vô dụng.
13. **Xoá phim = cascade im lặng**; nhánh 409 là code chết.
14. **Thống kê 30 ngày lấy 30 ngày cũ nhất**; doanh thu gom theo tháng hết hạn VIP.
15. **`daily_stats` không có writer** ⇒ dashboard đứng yên; **`app_settings` không seed** ⇒ banner null.
16. **Reindex ES không xoá doc cũ**, lỗi bị nuốt, `_bulk` item lỗi vẫn 200; sort theo `release_year`
    làm relevance vô nghĩa; `total` cap 10.000.
17. **CSV import sản phẩm không tạo embedding** ⇒ không bao giờ tìm được; rebuild lỗi làm mọi search 500.
18. **Sai đường dẫn static `/uploads`** ⇒ ảnh catalog admin 404.
19. **Affiliate không gắn tracking_id**, không chống bơm click, `searchId` không kiểm ownership.
20. **SerpAPI upload ảnh người dùng lên dịch vụ public 60 phút**.
21. **Không like được comment** (`comment_likes` bỏ rơi); không ẩn comment (chỉ xoá cứng).
22. **History**: cho lùi vị trí, mất `is_completed`, `last_watched_at` không cập nhật khi payload lặp.
23. **`unread` chỉ đếm trong 100 thông báo**; PATCH no-op trả 404 (`affectedRows` thay `changedRows`).
24. **Mute/kick ở PartyRoom reload cả phòng** ⇒ mất vị trí phát của mọi người.
25. **Crop CineLens lệch ~16 px**; không `setPointerCapture`; không `touch-action` (mobile không chọn được).
26. **Xung đột CSS layer** `.app button/input` đè Tailwind; **không ErrorBoundary** ⇒ trắng trang.
27. **HomePage "Xóa lọc"** làm `loading` kẹt `true`.
28. **Session của user bị khoá không bị revoke** ⇒ mở khoá là dùng lại được.
29. **Không có nút/flow resume video** dù backend đã lưu `last_position`.
30. **Export CSV ở trang Cài đặt hỏng**: `fetch` URL tương đối, không `Authorization`, Vite không proxy ⇒ 404.
31. **UI cho chọn `moderator` nhưng API từ chối** (select 3 role ở `UsersAdminPage`, backend chỉ nhận `user|admin`) ⇒ 400.

### P2 — vệ sinh / hiệu năng

32. `requireAuth` chạy 2–4 lần/request admin (4 bản guard trùng lặp, 403 không log).
33. Broadcast notification 1 câu SQL cho toàn bộ user, không batch.
34. Export CSV full-scan, không giới hạn, có PII + formula injection.
35. `/stats` chiếm 9/10 connection, không transaction.
36. Không rate limit ngoài auth; không `trust proxy`.
37. Log amplification: mỗi request sai token = 1 INSERT.
38. Search fallback `LIKE '%…%'` full scan; không FULLTEXT; thiếu 7 index composite.
39. `GROUP_CONCAT` mặc định 1024 byte ⇒ cắt cụt genres.
40. Code chết: `Test.js` (backend 5 + frontend 7), `Navbar`, `Logo`, `axios`, bảng `movies`,
    `comment_likes`, `bookmarks.notify_new_episode`, `comments.episode_id`, `allow_skip_votes`,
    `started_at`, `expires_at`, `daily_stats`, `cropMs`, `isLocalSeeking`, 4 hàm API, `x-user-id`,
    3 file migration auth không ai chạy, `prisma/`, script ERD.
41. Mojibake: `index.html` (title/meta) và comment `.githooks/pre-commit`.
42. Timezone trộn `CURRENT_TIMESTAMP` (DB) với `UTC_TIMESTAMP()` (code) ở bảng auth.

---

## 15. Điều tôi chưa thể khẳng định (cần bạn xác nhận)

1. **"Test user switcher"** (`x-user-id`, `zflix_active_user_id`, Navbar đổi user) là cố ý cho demo hay
   tàn dư cần xoá? Nó quyết định cách sửa socket auth.
2. **Watch Party là tính năng thật hay demo đồ án?** Mức đầu tư bảo mật khác nhau.
3. **Có cần email provider** (SMTP/Resend/SendGrid) cho forgot-password không?
4. **VIP/premium**: có muốn enforce thật (chặn `video_url`) hay chỉ để hiển thị?
5. **Elasticsearch**: triển khai ES thật (Docker) hay chấp nhận fallback MySQL?
6. **`NODE_ENV=production` trong `.env` dev** là cố ý hay nhầm? Nó bật cookie `Secure` + HSTS + tắt reset password.
7. **Prisma**: xoá hẳn hay viết schema MySQL thật? Hiện trạng "nửa Prisma" gây hiểu sai kiến trúc.
8. **Dữ liệu seed**: có cần bộ seed đăng nhập được (mật khẩu rõ ràng) để demo không?
