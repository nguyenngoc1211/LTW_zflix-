# Zflix: bản đồ dự án hiện tại

Cập nhật theo `main` tại `63cdba4` ngày 22/11/2026; code tương ứng `0bc2732` vì commit mới chỉ sửa README. Đây là phần tổng quan để định hướng đọc code, không thay thế source, API reference hoặc báo cáo kiểm thử từng thời điểm.

## Kiến trúc

```text
React/Vite frontend :5173
        │ REST / Socket.IO
        ▼
Express backend :3000 ─── MongoDB (cấu hình Compose)
        │                  Elasticsearch (search trên nhánh SQL)
        ├── Video processor FastAPI :8001 ─── Cloudflare R2
        └── AI chatbot FastAPI :8002 ─── Gemini + Chroma/BM25
```

`docker-compose.yml` không chạy MongoDB service. Cần cung cấp URI và tên database bên ngoài. Compose là cấu hình development-only.

## Chọn kho dữ liệu

- Compose và các file môi trường mẫu chọn `DATA_STORE=mongodb`.
- Node backend dùng MongoDB driver trực tiếp ở các module đã có nhánh MongoDB. Một số code cũ vẫn dùng `mysql2`, `DATABASE_URL` hoặc Prisma.
- `database/init.sql` và các migration `.sql` thuộc đường MySQL legacy; chúng không khởi tạo MongoDB Atlas.
- Chuyển đổi toàn bộ khỏi MySQL/Prisma chưa xong. Trước khi dùng một route trong môi trường MongoDB, kiểm tra nhánh route thực tế và dependencies của module đó.

## Nghiệp vụ chính trong source

- **Auth:** đăng ký local, login, refresh/session, MFA/TOTP, đổi/reset mật khẩu. Role và trạng thái user được đọc ở backend. Gửi email reset cần provider chưa có trong cấu hình mặc định.
- **Discovery:** filters, production list/detail, suggestions, top phim; search MongoDB trực tiếp hoặc Elasticsearch/MySQL tùy `DATA_STORE`.
- **Streaming:** chi tiết episode, history, HLS proxy và entitlement. Route nội dung cũ dưới `/api/streaming` còn có code Prisma/MySQL.
- **Community:** posts và scene questions, ảnh, comment, vote, poll, profile/follow, notifications, moderation, points, leaderboard và quests.
- **Payments/VIP:** đơn chuyển khoản qua trạng thái xét duyệt; không có xác nhận ngân hàng tự động. Reward VIP từ leaderboard cần admin duyệt.
- **Watch Party:** REST và Socket.IO; danh tính socket được xác thực từ token/session.
- **Shopping:** sản phẩm được gắn vào phim/tập theo thời gian; không cùng catalog với Lensy.
- **Lensy:** `/api/v1/scan` dùng Vision provider và marketplace search khi bật provider; tắt provider thì dùng CLIP/HNSW trên catalog. `/api/v1/visual-search` là CLIP trực tiếp.
- **Chatbot:** Python RAG service ở cổng 8002. Cần chỉ mục vector/BM25 và cấu hình Gemini để trả lời.

## Frontend route đáng chú ý

`frontend/src/routes/route.jsx` là nguồn sự thật. Các route chính gồm `/`, `/movies/:id`, `/community`, `/community/posts/:id`, `/community/users/:id`, `/leaderboard`, `/quests`, `/vip`, `/watch-party`, `/settings` và `/admin/*`. Admin có hub ở `/admin/community-hub`; một số route cũ chuyển hướng về các mục trong hub.

`ProtectedRoute` giúp điều hướng phía client. Backend middleware vẫn là nơi enforce auth, role, visibility và ownership.

## Kiểm thử và giới hạn

- Backend unit tests: chạy `cd backend-node; npm test`.
- Frontend: `npm run lint`, `npm run build` trong `frontend/`.
- Integration scripts ở `backend-node/integration/` có thể ghi dữ liệu. Chỉ chạy với database test riêng sau khi đọc guard trong từng script.
- Các lần kiểm thử tích hợp trong `AUTH_SECURITY_PROGRESS.md`, `MONGODB_MIGRATION_PROGRESS.md` và báo cáo module ghi lại ngày, database và phạm vi cụ thể. Chúng không chứng minh mọi luồng production đã được nghiệm thu.
- Docker Compose, email delivery, private media storage và triển khai nhiều instance cần cấu hình/kiểm thử riêng.

## Tài liệu dùng tiếp

- [Cài đặt nhóm](SETUP_TEAM.md)
- [Cấu trúc source](PROJECT_STRUCTURE.md)
- [API tham khảo](HAI_API_REFERENCE.md)
- [Deploy và giới hạn vận hành](DEPLOYMENT.md)
- [Auth/Security](AUTH_SECURITY_PROGRESS.md)
- [MongoDB migration](MONGODB_MIGRATION_PROGRESS.md)
