# Hướng dẫn các module Discovery, Community và Streaming

Tài liệu branch Hai cũ đã lỗi thời sau các lần tích hợp. Bản này mô tả module trong source hiện tại; xem [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) để hiểu toàn bộ ứng dụng và [`HAI_API_REFERENCE.md`](HAI_API_REFERENCE.md) để tra các route chính.

## Chạy phần web/API

Thực hiện theo [`SETUP_TEAM.md`](SETUP_TEAM.md). Môi trường hiện tại dùng MongoDB theo cấu hình Compose; cần database có dữ liệu và `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_ACCESS_SECRET`. Không chạy lệnh Docker/MySQL trong hướng dẫn branch cũ.

## Discovery

Module ở `backend-node/src/modules/discovery/` cung cấp filters, danh sách production, gợi ý tiêu đề, top phim và chi tiết phim. MongoDB path truy vấn trực tiếp collection; nhánh MySQL có thể dùng Elasticsearch và fallback SQL. Cách tìm kiếm vì vậy phụ thuộc `DATA_STORE`.

## Community

Các route đang chia theo nghiệp vụ:

- `community.routes.js`: favorites, interests, movie ratings/comments, notifications và preferences.
- `posts.routes.js`: feed, bài thường/câu hỏi cảnh phim, hình ảnh, vote, lưu, comments, reports.
- `profiles.routes.js`: profile công khai, cập nhật hồ sơ và follow.
- `points.routes.js`, `quests.routes.js`: bảng điểm, lịch sử điểm, điểm thưởng và nhiệm vụ.
- `moderation.routes.js`: gửi/xử lý reports và review flags.

Các route mới về Points, Quests và một số route Moderation yêu cầu MongoDB. Transaction và index liên quan phải được kiểm tra trên database test riêng trước khi thay đổi schema.

## Streaming và video

`streaming.routes.js` xử lý truy cập episode, history và quyền phát. `/api/v1/hls/*` proxy media từ R2. Route nội dung cũ nằm dưới `/api/streaming`; upload cần R2, ffmpeg, video-processor và `VIDEO_WEBHOOK_SECRET`. Không dựa vào route/UI frontend để kiểm soát quyền nội dung.

## Kiểm thử

```powershell
cd backend-node
npm test
```

Các `integration/*-smoke.js` là script riêng, không chạy chung với `npm test`. Đọc guard của script, xác nhận database test và tránh dùng URI database production.
