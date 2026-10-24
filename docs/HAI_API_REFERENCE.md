# API reference — branch Hai

Base URL: `http://localhost:3000/api/v1`.

Các endpoint ghi dữ liệu cá nhân không nhận `userId` từ request. Sau khi tích hợp
branch `Du`, danh tính luôn được lấy từ `req.user.id` do `requireAuth` cung cấp.

## Discovery — public

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/filters` | Danh sách thể loại, quốc gia và năm |
| GET | `/productions` | Tìm kiếm, lọc, sắp xếp và phân trang |
| GET | `/productions/:id` | Chi tiết phim và danh sách tập |
| GET | `/episodes/:episodeId` | Chi tiết một tập |

Query của `/productions`:

| Tham số | Giá trị |
| --- | --- |
| `search` | Tên/mô tả/thể loại; Elasticsearch xử lý không phân biệt hoa thường |
| `genre` | Tên thể loại chính xác |
| `country` | Quốc gia chính xác |
| `year` | Năm phát hành |
| `minRating` | Điểm tối thiểu từ 0 đến 5 |
| `sortYear` | `asc` hoặc `desc` |
| `page`, `limit` | Phân trang; `limit` tối đa 50 |

Ví dụ:

```http
GET /api/v1/productions?search=DaRk%20KnIgHt
GET /api/v1/productions?country=USA&year=2019&minRating=4&sortYear=desc
```

## Community

| Quyền | Method | Endpoint | Chức năng |
| --- | --- | --- | --- |
| Auth | GET | `/favorites` | Danh sách yêu thích |
| Auth | PUT/DELETE | `/favorites/:productionId` | Thêm hoặc bỏ yêu thích |
| Auth | GET | `/interests` | Danh sách đang quan tâm |
| Auth | PUT/DELETE | `/interests/:productionId` | Bật hoặc bỏ theo dõi tập mới |
| Public | GET | `/productions/:productionId/ratings` | Danh sách đánh giá |
| Auth | PUT/DELETE | `/productions/:productionId/rating` | Upsert hoặc xóa rating 1–5 |
| Public | GET | `/productions/:productionId/comments` | Danh sách bình luận |
| Auth | POST | `/productions/:productionId/comments` | Tạo bình luận |
| Auth | PATCH/DELETE | `/comments/:commentId` | Sửa hoặc xóa bình luận của chính mình |
| Auth | GET | `/notifications` | Danh sách và số thông báo chưa đọc |
| Auth | PATCH | `/notifications/:notificationId/read` | Đánh dấu một thông báo đã đọc |
| Auth | PATCH | `/notifications/read-all` | Đánh dấu tất cả đã đọc |

Payload rating:

```json
{ "rating": 5, "title": "Rất hay", "review": "Nội dung đánh giá" }
```

Payload comment:

```json
{ "content": "Nội dung bình luận", "parentId": null }
```

## Streaming

| Quyền | Method | Endpoint | Chức năng |
| --- | --- | --- | --- |
| Auth | GET | `/history` | Lịch sử xem của tài khoản |
| Auth | PUT | `/history/:episodeId` | Upsert vị trí xem, idempotent |
| Auth | DELETE | `/history/:episodeId` | Xóa một tập khỏi lịch sử |
| Auth | DELETE | `/history` | Xóa toàn bộ lịch sử |

Payload cập nhật vị trí:

```json
{ "position": 120 }
```

## Admin

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| POST | `/search/reindex` | Đồng bộ lại index Elasticsearch |
| POST | `/productions/:id/episodes` | Thêm tập và tạo thông báo cho người quan tâm |

Hai endpoint này yêu cầu `requireAuth` và `requireRole("admin")` sau khi merge `Du`.

## Mã lỗi chính

- `400`: payload/query không hợp lệ.
- `401`: chưa đăng nhập hoặc token/session không hợp lệ sau khi tích hợp Du.
- `403`: không đủ role.
- `404`: resource không tồn tại hoặc không thuộc người dùng.
- `503 AUTH_MODULE_NOT_INTEGRATED`: branch Hai đang chạy độc lập, chưa merge Du.
