# Hướng dẫn module của branch Hai

## Chức năng đã triển khai

- Tìm phim bằng Elasticsearch, không phân biệt chữ hoa/chữ thường.
- Lọc kết hợp theo thể loại, quốc gia, năm phát hành và rating; sắp xếp theo năm.
- Trang danh sách, chi tiết phim và danh sách tập.
- Yêu thích và danh sách quan tâm độc lập.
- Lưu/xóa lịch sử, phần trăm và vị trí xem tiếp.
- Rating 1–5 sao, tự cập nhật điểm trung bình; bình luận công khai, ghi bình luận cần đăng nhập.
- Tạo thông báo cho người quan tâm khi admin thêm tập mới.
- Danh sách thông báo và trạng thái đã đọc.

## Chạy branch Hai

Yêu cầu: Docker Desktop đang chạy và có tối thiểu khoảng 2 GB RAM trống cho toàn bộ stack.

Khi chạy bằng Docker Compose, biến môi trường đã có trong `docker-compose.yml`.
Nếu chạy service trực tiếp trên máy, sao chép `.env.example` thành `.env` trong
`backend-node` và `frontend`, rồi điều chỉnh giá trị theo môi trường của bạn.

```powershell
cd E:\LTW_BTL\zflix
docker compose up -d --build
docker compose ps
docker compose logs -f backend-node
```

Truy cập:

- Web: <http://localhost:5173>
- API: <http://localhost:3000>
- Elasticsearch: <http://localhost:9200>

Backend tự tạo/cập nhật index `productions` khi khởi động. Nếu đây là database mới, `database/init.sql` tự tạo toàn bộ schema.

Nếu volume MySQL đã tồn tại từ trước khi có bảng `production_interests`, chạy migration một lần:

```powershell
Get-Content -Raw .\database\migrate-hai.sql | docker exec -i movie_db mysql -uroot -prootpassword movie_streaming_db
docker compose restart backend-node
```

Dừng hệ thống (không xóa dữ liệu):

```powershell
docker compose down
```

## Kiểm tra nhanh

```powershell
Invoke-RestMethod 'http://localhost:3000/api/v1/productions?search=DaRk%20KnIgHt'
Invoke-RestMethod 'http://localhost:3000/api/v1/productions?country=USA&minRating=4&year=2019&sortYear=desc'
Invoke-RestMethod 'http://localhost:3000/api/v1/productions/1'

cd .\backend-node
npm ci
npm test

cd ..\frontend
npm ci
npm run lint
npm run build
```

## Ghép với branch Du

Branch Hai không chứa commit của Du. Hiện các API công khai chạy độc lập; API cá nhân trả `503 AUTH_MODULE_NOT_INTEGRATED` để bảo đảm fail-closed. Sau khi merge Du, bridge tại `business-auth.bridge.js` tự sử dụng `requireAuth` và `requireRole` thật của Du.

Khi xử lý xung đột tích hợp:

1. Trong backend `app.js`, giữ cấu hình `helmet`, CORS, cookie parser, `authRouter` và admin route của Du; đồng thời giữ ba lệnh mount `discoveryRouter`, `communityRouter`, `streamingRouter` của Hai.
2. Trong backend `server.js`, giữ server của Du và thêm lệnh `syncProductionIndex()` sau khi listen.
3. `frontend/src/services/api.js` của Hai dùng cùng contract với Du: token chỉ nằm trong bộ nhớ, refresh token qua cookie. Ưu tiên bản mới nhất của Du nếu file có xung đột.
4. Trong frontend, giữ `AuthProvider`, các trang đăng nhập và `ProtectedRoute` của Du; thêm các route `/movies/:id`, `/library`, `/history`, `/notifications`, `/watch/:episodeId` của Hai. Bọc ba trang cá nhân bằng `ProtectedRoute`.
5. Không gửi `userId` từ frontend. Backend của Hai luôn lấy chủ sở hữu từ `req.user.id`.

## API chính

Public: `GET /api/v1/filters`, `GET /api/v1/productions`, `GET /api/v1/productions/:id`, `GET /api/v1/episodes/:id`, ratings và comments dạng GET.

Authenticated: `/favorites`, `/interests`, `/history`, `/notifications`, ghi rating và ghi/sửa/xóa comment.

Admin: `POST /api/v1/search/reindex`, `POST /api/v1/productions/:id/episodes`.
