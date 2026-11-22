# API tham khảo Zflix

Tài liệu này thay cho bảng API cũ chỉ dành cho branch Hai. Các route dưới đây được đối chiếu với `backend-node/src/app.js` và module routes trên `main` tại `63cdba4`, code tương ứng `0bc2732`. Đây là danh sách tuyến chính, không phải OpenAPI đầy đủ; kiểm tra source trước khi dựa vào status code hoặc payload chi tiết.

Base URL mặc định: `http://localhost:3000`. Phần lớn API ở `/api/v1`. Endpoint cần đăng nhập dùng `Authorization: Bearer <access-token>`; refresh token nằm trong cookie HttpOnly do auth service quản lý.

## Discovery

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/api/v1/filters` | Public | Bộ lọc phim. |
| GET | `/api/v1/productions` | Public | Tìm kiếm, lọc, sắp xếp, phân trang. |
| GET | `/api/v1/productions/suggest` | Public | Gợi ý tiêu đề. |
| GET | `/api/v1/productions/top` | Public | Danh sách phim nổi bật theo dữ liệu xem. |
| GET | `/api/v1/productions/:id` | Public/optional auth | Chi tiết production và thông tin truy cập tập. |
| POST | `/api/v1/search/reindex` | Admin | Đồng bộ chỉ mục tìm kiếm trên nhánh hỗ trợ. |

Tham số lọc chính của `/productions`: `search`, `genre`, `country`, `year`, `minRating`, `sortYear`, `page`, `limit`.

## Tài khoản

Các endpoint auth được mount dưới `/api/v1/auth`: register, login, refresh-token, logout, me, MFA setup/status/enable/verify/disable, recovery-codes, password change/reset và session list/revoke/logout-all. Xem `backend-node/src/modules/auth/auth.routes.js` để biết validation, Origin guard, response và giới hạn từng endpoint.

Role và trạng thái tài khoản được backend đọc từ database. Frontend route guard không thay thế authorization của API.

## Community

Các route community dùng chung prefix `/api/v1`; bài viết và câu hỏi cảnh phim dùng `/api/v1/community/posts` và `/api/v1/scene-questions`.

| Khu vực | Endpoint tiêu biểu | Quyền |
|---|---|---|
| Favorites/interests | `/favorites`, `/interests` | Auth cho danh sách và ghi. |
| Ratings/comments phim | `/productions/:id/ratings`, `/productions/:id/comments`, `/comments/:id` | Đọc public/optional auth; ghi cần auth, thao tác theo chủ sở hữu/chính sách staff. |
| Bài viết | `/community/posts`, `/community/posts/with-images`, `/community/posts/:id` | Đọc theo visibility; tạo/sửa/xóa cần auth. |
| Bình luận bài | `/community/posts/:id/comments` | Đọc theo quyền bài; ghi cần auth. |
| Hồ sơ/follow | `/community/users/:id`, `/community/users/me`, `/:id/followers`, `/:id/following` | Hồ sơ public; cập nhật/follow cần auth. |
| Notifications | `/notifications`, `/notifications/preferences` | Auth; dữ liệu giới hạn theo tài khoản hiện tại. |
| Points | `/points/config`, `/points/months`, `/points/leaderboard`, `/points/me` | Public cho config/months/leaderboard; `/me` cần auth. |
| Quests | `/quests/me`, `/quests/:id/claim`, `/quests/achievements/:userId` | Trạng thái người dùng cần auth; achievement đã đạt có endpoint đọc public. |
| Moderation | `/moderation/reports` | Gửi report cần auth; admin report/flag routes nằm dưới `/api/v1/admin/moderation`. |

Points và quests hiện yêu cầu `DATA_STORE=mongodb`. Thưởng VIP theo bảng xếp hạng cần admin xét duyệt; đóng tháng không tự cấp quyền VIP.

## Streaming và Watch Party

- `/api/v1/episodes/:episodeId` và `/api/v1/history` phục vụ chi tiết tập/lịch sử; ghi history cần auth.
- `/api/v1/hls/*` là proxy media. Quyền phát có thể trả playback URL/token theo entitlement.
- Route quản trị nội dung legacy được mount dưới `/api/streaming`; webhook video dùng `/api/streaming/episodes/webhook/video-done` và `x-webhook-secret`.
- Watch Party REST ở `/api/v1/watch-party*`; Socket.IO namespace `/watch-party` có xác thực handshake. Chi tiết event xem `backend-node/src/modules/watch-party/watch-party.socket.js`.

## Shopping, VIP và Lensy

- Sản phẩm gắn theo phim/tập: `/api/v1/shopping/*`.
- Đơn VIP: `/api/v1/vip/plans`, `/api/v1/vip/orders`; xét duyệt staff ở `/api/v1/admin/vip-payments/orders`.
- Lensy catalog/vector: `/api/v1/visual-search/*`.
- Lensy trên player: `POST /api/v1/scan`, `GET /api/v1/scan/products/:id`.
- `VISION_PROVIDER` chỉ quyết định nhánh `/scan`. Với DeepSeek, ảnh được gửi tới provider đã cấu hình và backend dùng keyword tìm marketplace; khi `none`, `/scan` dùng CLIP/local catalog. `/visual-search` chạy CLIP độc lập.

## Python

- AI chatbot: `POST http://localhost:8002/api/v1/chat`.
- Video processor: FastAPI tại cổng 8001, nhận job xử lý video theo service contract.

## Lỗi thường gặp

- `400`: request/query không hợp lệ.
- `401`: thiếu hoặc hết hiệu lực của authentication khi endpoint yêu cầu session.
- `403`: đã đăng nhập nhưng role/quyền không đủ.
- `404`: tài nguyên không tồn tại hoặc bị ẩn theo chính sách ownership.
- `409`: xung đột trạng thái/idempotency ở các luồng hỗ trợ.
- `429`: rate limit của endpoint.
- `503`: một số module chỉ hoạt động ở MongoDB có thể trả lỗi nếu `DATA_STORE` khác `mongodb`.

Status cụ thể khác nhau theo route; đọc handler tương ứng để biết contract chính xác.
