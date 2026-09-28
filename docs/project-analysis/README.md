# Biên bản phân tích dự án Movie-Watching-Web

Tài liệu này bắt đầu từ câu hỏi thứ hai trong cuộc trao đổi và tổng hợp các nội dung được trích xuất trực tiếp từ source của dự án: database/ERD, API, UI và công nghệ đang sử dụng.

> Phạm vi: nội dung trao đổi giữa người dùng và trợ lý liên quan đến dự án. Không bao gồm system prompt, developer prompt và log nội bộ của công cụ.

## Mục lục

1. [Các yêu cầu từ câu hỏi thứ hai](#1-các-yêu-cầu-từ-câu-hỏi-thứ-hai)
2. [Database và ERD](#2-database-và-erd)
3. [API hiện có](#3-api-hiện-có)
4. [UI hiện có](#4-ui-hiện-có)
5. [Công nghệ sử dụng](#5-công-nghệ-sử-dụng)
6. [Liên kết nhanh tới source](#6-liên-kết-nhanh-tới-source)

---

## 1. Các yêu cầu từ câu hỏi thứ hai

Theo thứ tự thời gian, người dùng đã yêu cầu:

1. Chỉ phân tích dựa trên dự án hiện có; phần lời khuyên để sau. Trước hết, tạo hình ảnh các bảng từ `backend-node/prisma/schema.prisma`.
2. Liệt kê API đang tồn tại trong dự án.
3. Liệt kê UI đang được sử dụng trong dự án.
4. Liệt kê công nghệ đang được sử dụng trong dự án.
5. Tạo thư mục/file chứa nội dung cuộc trao đổi bắt đầu từ câu hỏi thứ hai.

---

## 2. Database và ERD

### 2.1. File nguồn

- Prisma schema: [`backend-node/prisma/schema.prisma`](../../backend-node/prisma/schema.prisma)
- SQL initialization: [`database/init.sql`](../../database/init.sql)

### 2.2. Hình ERD đã tạo

- [ERD PNG](../schema-prisma-erd.png)
- [ERD SVG, phóng to không vỡ](../schema-prisma-erd.svg)
- [Script tạo lại ERD](../../tools/generate-prisma-erd.mjs)

Ảnh ERD được dựng trực tiếp từ `schema.prisma`, không dùng ảnh AI bitmap, nhằm giữ chính xác tên bảng, cột, kiểu dữ liệu, khóa và quan hệ.

### 2.3. Danh sách 21 model/table trong Prisma

| Nhóm | Model |
|---|---|
| Nội dung | `productions`, `movies`, `series`, `seasons`, `episodes` |
| Phân loại | `genres`, `production_genres` |
| Diễn viên | `actors`, `production_actors` |
| Người dùng | `users`, `notifications` |
| Tương tác | `bookmarks`, `comments`, `comment_reactions`, `ratings`, `watch_history` |
| Thanh toán | `subscription_plans`, `transactions`, `user_subscriptions` |
| Watch Party | `watch_parties`, `watch_party_participants` |
| Analytics | `daily_stats` |

### 2.4. Quan hệ nội dung chính

```text
productions
├── movies (1:0..1)
├── series (1:0..1)
├── seasons (1:0..1; season cũng có production shell)
├── episodes (1:N)
├── production_genres (1:N)
├── production_actors (1:N)
├── bookmarks (1:N)
├── comments (1:N)
├── ratings (1:N)
└── watch_parties (1:N)

series
└── seasons (1:N)

episodes
├── watch_history (1:N)
├── comments (1:N)
└── watch_parties (1:N)
```

### 2.5. Quan hệ người dùng

```text
users
├── bookmarks
├── comments
├── comment_reactions
├── ratings
├── notifications
├── watch_history
├── transactions
├── user_subscriptions
├── watch_parties (host)
└── watch_party_participants
```

### 2.6. Enum trong Prisma

- `Type`: `movie`, `season`, `series`
- `Status`: `ongoing`, `completed`
- `users_role`: `admin`, `user`
- `actors_gender`: `male`, `female`, `other`, `unknown`
- `reaction_type`: `LIKE`, `DISLIKE`
- `comments_status`: `active`, `hidden`, `deleted`
- `transactions_status`: `pending`, `success`, `failed`, `cancelled`
- `transactions_payment_method`: `momo`, `vnpay`, `zalopay`, `credit_card`
- `user_subscriptions_status`: `active`, `expired`, `cancelled`
- `watch_parties_status`: `waiting`, `playing`, `paused`, `ended`
- `watch_party_participants_role`: `host`, `co-host`, `participant`
- `production_actors_role_type`: `cast`, `director`, `writer`, `producer`, `crew`
- `notifications_type`: `system`, `vip`, `new_episode`, `reply`, `like`, `warning`
- `notifications_entity_type`: `production`, `episode`, `comment`, `transaction`, `user`

### 2.7. Khác biệt đã quan sát giữa Prisma và init.sql

- SQL có bảng `comment_likes`, trong khi Prisma dùng `comment_reactions`.
- Prisma có reaction `LIKE` và `DISLIKE`, đồng thời có `dislikes_count` và `is_spoiler` trong comment.
- SQL có `watch_party_chats`, Prisma không có model tương ứng.
- Cấu trúc `watch_parties` và `watch_party_participants` trong SQL có nhiều cột hơn model Prisma hiện tại.
- Prisma đang mô hình hóa `season` vừa là một loại `production`, vừa có bảng `seasons`.

---

## 3. API hiện có

Tổng số REST endpoint đã thống kê:

- Node.js: 48 endpoint.
- AI Chatbot: 7 endpoint.
- Video Processor: 1 endpoint.
- Tổng: 56 endpoint, không tính tài liệu OpenAPI tự sinh của FastAPI.

### 3.1. Quy ước xác thực hiện tại

- `Public`: không cần đăng nhập.
- `Optional auth`: có thể gửi Bearer token để nhận thêm dữ liệu người dùng.
- `User`: `Authorization: Bearer <accessToken>`.
- `Admin`: Bearer token với `role = admin`.
- Refresh token lưu trong HTTP-only cookie tên `refreshToken`.

### 3.2. System

| Method | Endpoint | Quyền | Kết quả |
|---|---|---|---|
| `GET` | `/` | Public | `Hello from Movie Streaming Backend!` |

### 3.3. Authentication

Base path: `/api/v1/auth`

| Method | Endpoint | Quyền | Request chính |
|---|---|---|---|
| `POST` | `/register` | Public | `{ email, password, username }` |
| `POST` | `/login` | Public | `{ email, password }` |
| `POST` | `/google` | Public | `{ credential }` |
| `POST` | `/refresh-token` | Refresh cookie | Không có body |
| `POST` | `/logout` | Public/cookie | Không có body |
| `PUT` | `/profile` | User | `{ username?, password?, avatar_url? }` |

Response đăng nhập/đăng ký:

```json
{
  "accessToken": "jwt-access-token",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "avatar_url": "/default-avatar.png",
    "role": "user",
    "is_premium": false,
    "vip_expires_at": null,
    "provider": "local",
    "created_at": "..."
  },
  "message": "Login successful"
}
```

### 3.4. Production/Streaming

Base path: `/api/streaming/productions`

| Method | Endpoint | Quyền thực tế | Dữ liệu |
|---|---|---|---|
| `GET` | `/search?q=` | Public | Tìm title/description, tối đa 10 |
| `GET` | `/popular` | Public | Top 10 production completed |
| `GET` | `/genres` | Public | Danh sách genre |
| `GET` | `/list` | Public | Filter và sort production |
| `GET` | `/detail/:slug` | Public | Chi tiết production |
| `POST` | `/upload-video` | Không có middleware auth | Multipart tạo movie/series |
| `PUT` | `/update/:id` | Không có middleware auth | Multipart cập nhật production |
| `DELETE` | `/delete/:id` | Không có middleware auth | Xóa production |

Query của `/list`:

- `scope=home`
- `genre=id-or-slug,id-or-slug`
- `year=YYYY`
- `country=value`
- `type=movie|series|all`
- `sort=popular|rating|latest|title`

Form tạo production:

```text
video
title
description
release_year
is_premium
type
status
poster_url
banner_url
country
language
duration
genres          JSON array genre IDs
actors          JSON array actors
```

Actor payload:

```json
[
  {
    "name": "Actor name",
    "avatar_url": "https://...",
    "character": "Character name"
  }
]
```

### 3.5. Season và Episode

Base path: `/api/streaming/episodes`

| Method | Endpoint | Quyền thực tế | Request |
|---|---|---|---|
| `GET` | `/seasons/:seasonId/episodes` | Public | Path season ID |
| `POST` | `/series/:seriesId/seasons` | Không có auth | `{ season_number }` |
| `POST` | `/` | Không có auth | Multipart episode |
| `PUT` | `/:id` | Không có auth | Multipart episode |
| `DELETE` | `/:id` | Không có auth | Path episode ID |
| `POST` | `/webhook/video-done` | Không có auth | Video callback |

Episode form:

```text
video
production_id
episode_number
title
duration
thumbnail_url
video_url
```

Video webhook:

```json
{
  "production_id": 1,
  "episode_id": 10,
  "m3u8_url": "https://cdn.example.com/hls/movie/playlist.m3u8"
}
```

### 3.6. Watchlist

Base path: `/api/v1/watchlist`; tất cả yêu cầu Bearer token.

| Method | Endpoint | Request/response chính |
|---|---|---|
| `GET` | `/` | `{ items }` |
| `POST` | `/` | `{ productionId }` → `{ item, message }` |
| `DELETE` | `/:productionId` | `{ message }` |
| `GET` | `/check/:productionId` | `{ inWatchlist }` |

### 3.7. Lịch sử xem

Base path: `/api/v1/history`; tất cả yêu cầu Bearer token.

| Method | Endpoint | Request/response chính |
|---|---|---|
| `GET` | `/` | `{ history }` |
| `POST` | `/` | Cập nhật tiến trình xem |

Payload cập nhật:

```json
{
  "episode_id": 15,
  "last_position": 1200,
  "watched_duration": 1100,
  "total_duration": 3600,
  "is_completed": false
}
```

### 3.8. Comment và Rating

Base path: `/api/comment`

| Method | Endpoint | Quyền |
|---|---|---|
| `GET` | `/:movieId/comments` | Optional auth |
| `GET` | `/comments/:parentId/replies` | Optional auth |
| `POST` | `/comments` | User |
| `PUT` | `/comments/:id` | User, chính chủ |
| `DELETE` | `/comments/:id` | Chính chủ hoặc admin |
| `POST` | `/comments/:id/reaction` | User |

Tạo comment/rating:

```json
{
  "productionId": 1,
  "episodeId": 10,
  "content": "Phim rất hay",
  "parentId": null,
  "isSpoiler": false,
  "rating": 9
}
```

Reaction:

```json
{
  "reactType": "LIKE"
}
```

Các giới hạn hiện có:

- Root comments mặc định 15.
- Replies mặc định 10.
- Tối đa 50 phần tử mỗi request.
- Nội dung từ 1 đến 1000 ký tự.
- Tối đa 5 comment/phút/người dùng.
- Chặn nội dung trùng trong 30 giây.

### 3.9. Payment

Base path: `/api/v1/payments`

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| `POST` | `/payos/create-url` | User | Tạo PayOS URL |
| `GET` | `/payos/return` | Public | PayOS redirect |
| `POST` | `/payos/webhook` | Public | PayOS webhook |
| `GET` | `/payos/webhook` | Public | Webhook health check |
| `GET` | `/history` | User | Lịch sử giao dịch |
| `GET` | `/current-subscription` | User | Gói hiện tại |

Tạo liên kết thanh toán:

```json
{
  "planCode": "vip_1_month"
}
```

### 3.10. Admin

Base path: `/api/v1/admin`; yêu cầu Bearer token và role `admin`.

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/users` | Danh sách user |
| `POST` | `/users` | Tạo user |
| `PUT` | `/users/:id` | Cập nhật user |
| `DELETE` | `/users/:id` | Xóa user |
| `GET` | `/transactions` | Danh sách giao dịch |
| `GET` | `/subscriptions` | Danh sách subscription |

### 3.11. Analytics

Base path: `/api/admin/analytics`

| Method | Endpoint | Quyền thực tế |
|---|---|---|
| `GET` | `/dashboard?range=` | Không có middleware auth |

Range frontend sử dụng:

- `today`
- `7days`
- `30days`
- `90days`

### 3.12. Meeting/Watch Party REST API

Base path: `/api/meeting`; yêu cầu Bearer token.

| Method | Endpoint | Request |
|---|---|---|
| `POST` | `/create` | `{ title, productionId?, episodeId? }` |
| `POST` | `/:meetingId/join` | Không có body |

Response chứa:

```json
{
  "success": true,
  "data": {
    "meetingId": "meeting-id",
    "token": "cloudflare-participant-token",
    "userId": 1,
    "role": "host"
  }
}
```

### 3.13. Video Processor

Base URL: `http://localhost:8001`

| Method | Endpoint | Quyền thực tế |
|---|---|---|
| `POST` | `/process-video` | Không xác thực |

```json
{
  "file_name": "raw/movies/video.mp4",
  "production_id": 1,
  "episode_id": 10
}
```

### 3.14. AI Chatbot

Base URL: `http://localhost:8002`

| Method | Endpoint | Quyền thực tế |
|---|---|---|
| `GET` | `/` | Public |
| `POST` | `/api/v1/chat` | Public |
| `GET` | `/api/v1/history/:userId` | Public |
| `GET` | `/api/v1/history/:userId/:conversationId` | Public |
| `DELETE` | `/api/v1/history/:userId/:conversationId` | Public |
| `POST` | `/api/v1/ingest` | Public |
| `GET` | `/api/v1/ingest/stats` | Public |

Chat request:

```json
{
  "user_id": "1",
  "message": "Gợi ý cho tôi một phim khoa học viễn tưởng",
  "conversation_id": null
}
```

Chat response:

```json
{
  "conversation_id": "conversation-id",
  "answer": "Nội dung trả lời...",
  "sources": [
    {
      "production_id": 10
    }
  ]
}
```

### 3.15. Socket.IO events

Socket base: `http://localhost:3000`.

Comment — client gửi:

- `join_production`
- `leave_production`

Comment — server gửi:

- `new_comment`
- `new_reply`
- `comment_reaction_updated`
- `comment_deleted`

Watch Party — client gửi:

- `join_party`
- `host_change_movie`
- `host_sync_video`

Watch Party — server gửi:

- `party_state`
- `movie_changed`
- `guest_sync_video`
- `party_ended`
- `socket_error`

Frontend có lắng nghe `assigned_as_host`, nhưng backend hiện không phát event này.

---

## 4. UI hiện có

### 4.1. Công nghệ UI

| Thành phần | Công nghệ |
|---|---|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Routing | React Router DOM 7 |
| CSS chính | Tailwind CSS 4 |
| Component library | Ant Design 5 |
| Admin UI | Ant Design Pro Components |
| Icons | React Icons, Ant Design Icons, Lucide React |
| Meeting UI | Cloudflare RealtimeKit React UI |
| Markdown chatbot | React Markdown |
| Realtime UI | Socket.IO Client |

### 4.2. Phong cách giao diện

- Giao diện xem phim chủ yếu dùng dark theme.
- Nền: `gray-950`, `#121212`, `#1a1a1d`.
- Card: `#1e1e1e`, `#2a2a2d`, `#18181b`.
- Màu thương hiệu: `#ffdd95`.
- Chữ trắng/xám sáng.
- Card bo góc, border xám tối, shadow và hover transition.
- Logo chữ: `NETFLICK`.
- Font: `font-sans`, không có font tùy chỉnh được import.

### 4.3. Layout

Main Layout:

```text
Header
Main route outlet
Footer
Floating Chatbot
```

Route `/meeting` dùng toàn màn hình và bỏ Header/Footer/Chatbot.

User Layout:

```text
Header
Greeting
Horizontal tabs
Child route outlet
```

Các tab:

- Profile
- Continue Watching
- Lịch sử giao dịch
- Watch List
- Nâng cấp VIP
- Settings

Admin Layout:

```text
Collapsible sidebar
Admin header + avatar dropdown
Content outlet
```

Menu admin:

- Analytics & System
- Users Management
- Transactions
- Subscriptions
- Content Management

Auth Layout:

- Ảnh phi hành gia Interstellar làm nền.
- Blur 8px.
- Overlay đen 80%.
- Form glassmorphism.
- Logo NETFLICK màu vàng.

### 4.4. Header

Header gồm:

- Logo NETFLICK.
- Search box.
- Search dropdown.
- Trang chủ.
- Phim bộ.
- Phim lẻ.
- Mới nhất.
- Watch Party.
- Đăng nhập/đăng ký hoặc avatar người dùng.

Search:

- Hiển thị từ breakpoint `md`.
- Bắt đầu tìm từ hai ký tự.
- Debounce 400ms.
- Kết quả có poster, title, type và release year.

### 4.5. Trang chủ

Route `/` gồm:

- Hero Slider.
- Category Tabs.
- Trending Section với tab ngày/tuần/tháng.
- Phim đề xuất cho bạn.
- Phim mới cập nhật.
- Phim bộ hot.
- Phim hành động.
- Phim hoạt hình.

Movie card hiển thị poster, overlay, play button, title, year, rating, genre và nhãn chất lượng/tập.

### 4.6. Browse

Routes:

- `/movies`
- `/series`

Giao diện gồm sidebar filter và movie grid.

Filter:

- Genre.
- Type.
- Country.
- Active filter badges.

Sort:

- Trending.
- Rating.
- Newest.
- A–Z.

### 4.7. Chi tiết và xem phim

Route `/watch/:slug`:

- Không có `?ep=`: `MovieInfoPage`.
- Có `?ep=`: `WatchPage`.

Trang chi tiết:

- Hero/banner.
- Poster.
- Metadata.
- Description.
- Tags.
- Actors.
- Watch button.
- Watchlist.
- Related movies.
- Comments.
- Popular list.

Trang xem phim desktop:

```text
Episodes: 2 cột
Video Player: 7 cột
Movie Info: 3 cột

Comments: 9 cột
Recommended: 3 cột
Related Movies: toàn chiều rộng
```

Video Player sử dụng HTML5 `<video controls>` và có:

- Auto Play.
- Auto Next.
- Next Episode.
- Light On/Off.
- Resume từ `?pos=`.
- Lưu lịch sử mỗi 10 giây.
- Preview VIP 30 giây.
- Modal nâng cấp VIP.

### 4.8. Authentication UI

`/login`:

- Email.
- Password.
- Forgot password link.
- Local login.
- Google login.
- Error/loading state.

`/register`:

- Username.
- Email.
- Password.
- Confirm password.
- Google registration.
- Error/loading state.

Route `/forgot-password` được liên kết nhưng chưa tồn tại trong router.

### 4.9. User UI

| Route | Nội dung |
|---|---|
| `/user/profile` | Thông tin tài khoản và đổi mật khẩu |
| `/user/history` | Continue Watching grid và progress |
| `/user/transactions` | Bảng giao dịch |
| `/user/favorites` | Watchlist grid |
| `/user/notifications` | Empty notification state |
| `/user/settings` | Language/theme UI tĩnh |
| `/user/plans` | Danh sách gói VIP |
| `/user/checkout` | Checkout PayOS |

Gói UI hiện hiển thị:

- Free: `0đ`.
- VIP Basic: `69.000đ/tháng`.
- VIP Pro: `399.000đ/6 tháng`.
- VIP Premium: `699.000đ/năm`.

### 4.10. Admin UI

`/admin` Analytics:

- KPI cards.
- Traffic trend.
- Traffic sources.
- Revenue breakdown.
- System overview.
- Service status.
- Resource usage.
- System alerts.

`/admin/users`:

- Tổng user/admin/VIP.
- Search/filter.
- User table.
- Create/edit/change role/delete.

`/admin/transactions`:

- Tổng giao dịch/thành công/doanh thu/pending.
- Search/filter.
- Table.
- Detail modal.

`/admin/subscriptions`:

- Tổng/active/expired/cancelled.
- Search/filter.
- Table.

`/admin/content`:

- Ant Design `ProTable`.
- Poster, title, genres, type, premium, year, actions.
- Create/edit production.
- View detail drawer.
- Season manager drawer.
- Episode modal.
- Delete confirmation.

### 4.11. Meeting/Watch Party UI

`/meeting`:

- Nền sáng `slate-50`.
- Card trắng.
- Create Meeting.
- Join Meeting.

`/meeting/:meetingId`:

- RealtimeKit setup screen.
- Camera/microphone.
- Participant grid.
- Pagination.
- Meeting chat.
- Participant list.
- Settings.
- Leave confirmation.
- Watch Party Player.
- Theater mode.

### 4.12. Chatbot UI

Chatbot nổi trong Main Layout, ngoại trừ meeting:

- Open/close button.
- Header.
- Message list.
- Markdown bot response.
- Loading state.
- Suggestions.
- Input/send.
- Movie recommendation cards.
- Poster, title, type, rating, duration, year, description.
- Click card để mở phim.

### 4.13. Responsive

Breakpoint Tailwind được dùng:

- `sm`
- `md`
- `lg`
- `xl`

Homepage còn có media query riêng tại:

- 1400px.
- 1024px.
- 768px.

### 4.14. Route UI hiện tại

| Route | UI |
|---|---|
| `/` | Homepage |
| `/movies` | Browse movies |
| `/series` | Browse series |
| `/watch/:slug` | Movie detail/player |
| `/meeting` | Create/join meeting |
| `/meeting/:meetingId` | Active meeting |
| `/user/profile` | Profile |
| `/user/history` | Watch history |
| `/user/transactions` | Transactions |
| `/user/favorites` | Watchlist |
| `/user/notifications` | Notifications |
| `/user/settings` | Settings |
| `/user/plans` | VIP plans |
| `/user/checkout` | Checkout |
| `/admin` | Analytics |
| `/admin/users` | User management |
| `/admin/transactions` | Transaction management |
| `/admin/subscriptions` | Subscription history |
| `/admin/content` | Content management |
| `/login` | Login |
| `/register` | Register |
| `*` | 404 |

---

## 5. Công nghệ sử dụng

### 5.1. Ngôn ngữ và định dạng

| Công nghệ | Vai trò |
|---|---|
| JavaScript ES Modules | Backend Node.js |
| JSX | React frontend |
| Python | Video Processor và AI Chatbot |
| Prisma Schema Language | Database schema |
| SQL | MySQL initialization/seed |
| CSS | Style giao diện |
| YAML | Docker Compose |
| Shell | AI database setup |
| JSON | Package/configuration |
| Markdown | Tài liệu |

Frontend và backend Node hiện dùng JavaScript, không dùng TypeScript cho source chính.

### 5.2. Frontend stack

| Công nghệ | Phiên bản | Vai trò |
|---|---:|---|
| React | 19.2.0 | UI framework |
| React DOM | 19.2.0 | Browser rendering |
| Vite | ^7.2.4 | Dev/build |
| React Router DOM | ^7.12.0 | SPA routing |
| Tailwind CSS | ^4.1.18 | Utility CSS |
| Ant Design | 5.27.0 | UI components |
| Ant Design Icons | 6.0.0 | Icons |
| Ant Design Pro | ^2.7.17 | Admin ProTable |
| React Icons | 5.5.0 | Icons |
| Lucide React | ^1.7.0 | Icons |
| Axios | ^1.13.2 | HTTP |
| Socket.IO Client | ^4.8.3 | Realtime |
| RealtimeKit React | ^1.1.7 | Meeting SDK |
| RealtimeKit React UI | ^1.0.6 | Meeting UI |
| React Markdown | ^10.1.0 | Chatbot Markdown |

### 5.3. Backend Node stack

| Công nghệ | Phiên bản | Vai trò |
|---|---:|---|
| Node.js Alpine | 22 | Runtime |
| Express | ^5.2.1 | REST API |
| Prisma/Client | 5.22.0 | ORM |
| MySQL2 | ^3.16.2 | MySQL driver |
| Socket.IO | ^4.8.3 | Realtime server |
| JSON Web Token | ^9.0.3 | JWT auth |
| bcryptjs | ^3.0.3 | Password hash |
| cookie-parser | ^1.4.7 | Cookie parsing |
| CORS | ^2.8.5 | Cross-origin |
| Multer | ^2.0.2 | Multipart upload |
| Google Auth Library | ^10.6.1 | Google credential |
| PayOS SDK | ^1.0.5 | Payment |
| AWS S3 Client | ^3.975.0 | Cloudflare R2 |
| AWS Lib Storage | ^3.975.0 | R2 upload |
| Axios | ^1.13.2 | HTTP client |
| dotenv | ^17.2.3 | Environment variables |
| Nodemon | ^3.1.11 | Development reload |

### 5.4. Database/storage

| Công nghệ | Vai trò |
|---|---|
| MySQL 8.0 | Database nghiệp vụ chính |
| Prisma | ORM/schema |
| MongoDB | AI chat history |
| Motor | Async MongoDB driver |
| PyMongo | MongoDB driver |
| ChromaDB | Vector database |
| BM25/pickle | Keyword index |
| Cloudflare R2 | Object/video storage |

MongoDB được dùng trong source AI nhưng chưa có service tương ứng trong Docker Compose hiện tại.

### 5.5. Video Processor

| Công nghệ | Vai trò |
|---|---|
| Python 3.9-slim | Runtime |
| FastAPI | Video job API |
| Uvicorn | ASGI server |
| FastAPI BackgroundTasks | Background processing |
| FFmpeg | Video → HLS |
| ffmpeg-python | FFmpeg wrapper |
| HLS/M3U8/MPEG-TS | Streaming format |
| boto3 | R2 S3-compatible access |
| requests | Node webhook |
| python-multipart | Multipart |
| python-dotenv | Env configuration |

Video flow:

```text
R2 raw video
→ download
→ FFmpeg HLS (10-second segments, codec copy)
→ upload m3u8/ts to R2
→ webhook Node.js
```

### 5.6. AI Chatbot

| Công nghệ | Vai trò |
|---|---|
| Python 3.9-slim | Runtime |
| FastAPI | Chat/history/ingestion API |
| Uvicorn | ASGI server |
| Pydantic | Schemas |
| LangChain | RAG pipeline |
| Google Gemini | LLM generation |
| Hugging Face | Embeddings |
| Sentence Transformers | Embedding/reranking models |
| CrossEncoder | Reranker |
| ChromaDB | Vector retrieval |
| BM25 | Keyword retrieval |
| MySQL Connector | Source movie data |
| MongoDB/Motor | Chat history |

RAG pipeline:

```text
MySQL data
→ document loading
→ chunking
→ BGE-M3 embedding
→ ChromaDB + BM25
→ hybrid search
→ BGE reranker
→ Gemini
→ answer + production sources
```

Model mặc định trong code:

| Thành phần | Model/config |
|---|---|
| LLM | `gemini-3-flash` |
| Embedding | `BAAI/bge-m3` |
| Reranker | `BAAI/bge-reranker-v2-m3` |
| LLM temperature | `0.4` |
| LLM max tokens | `1024` |
| Chunk size | `1024` |
| Chunk overlap | `100` |
| Retrieval top K | `10` |
| Reranker top K | `8` |
| Hybrid alpha | `0.5` |

`langchain-openai` có trong requirements, nhưng generator hiện dùng `ChatGoogleGenerativeAI`.

### 5.7. Cloud services

Cloudflare R2:

- Raw video storage.
- HLS playlist.
- Video segments.
- S3-compatible API.
- Node dùng AWS SDK.
- Python dùng boto3.

Cloudflare RealtimeKit:

- Meeting creation.
- Participant token.
- Video/audio call.
- Camera/microphone UI.
- Participants/chat/settings.

Google:

- Google Identity credential phía frontend.
- `google-auth-library` phía backend.
- Gemini phía AI service.

PayOS:

- Payment link.
- Return URL.
- Webhook.
- MySQL transaction/subscription persistence.

### 5.8. Docker và runtime

| Container | Image/runtime | Port |
|---|---|---:|
| `movie_db` | MySQL 8.0 | 3306 |
| `backend_node` | Node 22 Alpine | 3000 |
| `video_service` | Python 3.9 Slim | 8001 |
| `ai_service` | Python 3.9 Slim | 8002 |
| `frontend_react` | Node 22 Alpine | 5173 |

Development commands:

- Frontend: `vite`.
- Node: `nodemon src/app.js`.
- Python: `uvicorn --reload`.
- Full system: `docker compose up`.

### 5.9. Development tooling

| Công nghệ | Vai trò |
|---|---|
| npm | JavaScript packages |
| pip | Python packages |
| ESLint 9 | Frontend lint |
| React Hooks ESLint Plugin | Hooks lint |
| React Refresh | Fast Refresh |
| Nodemon | Node reload |
| Vite HMR | Frontend reload |
| Uvicorn reload | Python reload |
| Prisma CLI | Prisma Client generation |
| Docker Compose | Service orchestration |
| Git | Source control |

---

## 6. Liên kết nhanh tới source

- [README dự án](../../README.md)
- [Docker Compose](../../docker-compose.yml)
- [Frontend package](../../frontend/package.json)
- [Frontend routes](../../frontend/src/app/routes/route.jsx)
- [Node package](../../backend-node/package.json)
- [Node app entry](../../backend-node/src/app.js)
- [Prisma schema](../../backend-node/prisma/schema.prisma)
- [Database init SQL](../../database/init.sql)
- [Video requirements](../../backend-python/video-processor/requirements.txt)
- [AI requirements](../../backend-python/ai-chatbot/requirements.txt)
- [AI config](../../backend-python/ai-chatbot/src/config.py)
- [ERD PNG](../schema-prisma-erd.png)
- [ERD SVG](../schema-prisma-erd.svg)
