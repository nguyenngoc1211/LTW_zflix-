# Triển khai Zflix

## Trạng thái cấu hình hiện tại

`docker-compose.yml` được ghi rõ là **development-only**. Compose cài dependency trong image chạy backend/frontend ở chế độ dev, bật Elasticsearch không có authentication và trông chờ một MongoDB bên ngoài. Không dùng nguyên cấu hình này làm production.

Source có nhánh MongoDB và phần tương thích MySQL cũ; việc chuyển mọi route và tác vụ vận hành sang MongoDB chưa hoàn tất. Trước khi triển khai thật, cần xác nhận các route sản phẩm dùng có hoạt động với `DATA_STORE=mongodb`, backup/restore được, và database hỗ trợ transaction cho các nghiệp vụ tương ứng.

## Cấu hình cần có

Đặt secret trong secret manager hoặc biến môi trường của môi trường chạy, không commit `.env`.

| Biến | Cần khi nào | Ghi chú |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB_NAME` | Backend/AI chatbot dùng MongoDB | Compose yêu cầu cả hai. URI không được ghi vào log hoặc tài liệu. |
| `JWT_ACCESS_SECRET` | Backend Node | Bắt buộc; production từ chối secret yếu hoặc giá trị mẫu. |
| `MFA_ENCRYPTION_KEY` | Backend production | Base64 của đúng 32 byte ngẫu nhiên. |
| `FRONTEND_ORIGIN` | Browser gọi backend | Danh sách origin phân cách bằng dấu phẩy, phải khớp origin thực. |
| `R2_*`, `VIDEO_WEBHOOK_SECRET` | Upload và xử lý video | Cấu hình cùng giá trị webhook ở backend và video-processor. |
| `VISION_PROVIDER`, `DEEPSEEK_API_KEY` | Lensy dùng DeepSeek | Chỉ truyền ảnh tới provider ngoài khi chọn provider này. Để `none` thì `/scan` dùng catalog CLIP. |
| `GEMINI_API_KEY` | AI chatbot | Compose truyền key cho chatbot Python, không dùng cho Vision Node. |
| `VIP_BANK_*` | Nhận chuyển khoản VIP thật | Thiếu cấu hình, payload QR ở chế độ DEMO, không phải giao dịch có thể thu tiền. |

File mẫu: [`.env.example`](../.env.example) và [`backend-node/.env.example`](../backend-node/.env.example). Không sao chép giá trị mẫu vào môi trường production.

## Chạy stack phát triển

```powershell
Copy-Item .env.example .env
```

Điền `MONGODB_URI`, `MONGODB_DB_NAME` và `JWT_ACCESS_SECRET`, sau đó chạy:

```powershell
docker compose up --build
```

Compose mở các cổng 3000 (API), 5173 (Vite), 8001 (video), 8002 (chatbot) và 9200 (Elasticsearch). MongoDB không được chạy trong Compose. Các cổng service được publish ra host; chỉ chạy ở mạng tin cậy hoặc cấu hình firewall phù hợp.

## Checklist trước production

1. Tạo deployment MongoDB có hỗ trợ transaction, tài khoản DB quyền tối thiểu, backup và quy trình restore đã thử.
2. Dùng cấu hình chạy production riêng: image/build production, process manager, health checks, restart policy, TLS/reverse proxy, CORS origins cụ thể, firewall và giới hạn truy cập admin.
3. Đặt JWT, MFA, MongoDB, R2, DeepSeek, Gemini chatbot và bank secrets trong secret manager. Xoay mọi credential mẫu hoặc đã bị lộ.
4. Kiểm tra bucket R2 và media. Hiện một số URL media là public; playback proxy không thay thế việc làm bucket private.
5. Kiểm tra quyền trên tất cả route admin, community, points, quests, VIP và Watch Party bằng database test riêng trước khi deploy.
6. Quyết định bật/tắt `POINTS_MONTH_CLOSE_ENABLED`. Job tháng đóng bảng xếp hạng và tạo reward pending-review; không tự duyệt VIP.
7. Cấu hình provider gửi email trước khi công bố flow reset mật khẩu cho người dùng. Nếu chưa có email provider, user không nhận được link reset qua email.
8. Chạy `npm test`, `npm run lint`, `npm run build` và integration/browser smoke trên môi trường test tương đương. Những test có ghi dữ liệu không được trỏ vào database production.

## Giới hạn đã biết

- Compose không phải bản production: backend/frontend chạy lệnh dev, Elasticsearch tắt security và database được quản lý ngoài stack.
- `DATA_STORE=mongodb` là cấu hình Compose hiện tại, nhưng mã MySQL/Prisma và các module legacy vẫn còn. Xác nhận đường đi của từng endpoint trong môi trường đích.
- `npm run test:integration` hiện tập trung vào auth/password/MFA/registration; nhiều smoke test Mongo khác là script riêng trong `backend-node/integration/` và có thể ghi dữ liệu.
- CLIP/HNSW của Lensy chạy trong process backend. Chất lượng phụ thuộc ảnh và embedding trong catalog; benchmark self-query không chứng minh độ chính xác trên ảnh crop phim.
- Production deployment, gửi mail, R2 private bucket, scale nhiều backend instance và Socket.IO qua reverse proxy cần kiểm thử/cấu hình riêng.

Xem [hướng dẫn cài đặt nhóm](SETUP_TEAM.md) để chạy local và [cấu trúc dự án](PROJECT_STRUCTURE.md) để tìm module/API.
