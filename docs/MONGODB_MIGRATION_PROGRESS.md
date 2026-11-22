# Tiến độ chuyển Zflix sang MongoDB

Cập nhật 22/11/2026 theo `main` tại `63cdba4`; code tương ứng `0bc2732` vì commit mới chỉ sửa README. Đây là nhật ký chuyển đổi, không phải khẳng định toàn hệ thống đã chạy production trên MongoDB.

## Trạng thái hiện tại

- `docker-compose.yml` chọn `DATA_STORE=mongodb` và nhận `MONGODB_URI`, `MONGODB_DB_NAME` từ file `.env` gốc. MongoDB không chạy như service trong Compose.
- Backend Node có hai đường truy cập dữ liệu: MongoDB driver trực tiếp và các nhánh MySQL legacy dùng `mysql2`. `pool.js` trả `null` khi `DATA_STORE=mongodb` và không có `DATABASE_URL`; route legacy còn gọi pool có thể thất bại nếu chưa có nhánh Mongo tương ứng.
- Nhiều module chính hiện có xử lý MongoDB: auth, discovery, community/posts, streaming/history, Watch Party, admin, shopping, visual-shopping, points, quests, moderation, VIP và avatar. Hỗ trợ cụ thể vẫn cần đối chiếu ở từng route; module Points/Quests và một số moderation endpoint yêu cầu MongoDB.
- Compose không chạy MySQL migration hay tự nạp dữ liệu phim vào MongoDB. `database/init.sql` và các file SQL là dành cho phần code cũ, không tạo schema trên MongoDB Atlas.
- Chuyển hoàn toàn khỏi MySQL/Prisma **chưa hoàn tất**. Dependency, pool và một số nhánh route/script vẫn còn trong source.

## Kiến trúc lưu trữ

- `backend-node/src/core/database/mongo.js` quản lý MongoClient, collection, chuyển BSON `Decimal128` khi trả JSON, cấp ID số và transaction.
- `backend-node/src/core/database/pool.js` cung cấp pool MySQL nếu có `DATABASE_URL` và chế độ không chọn MongoDB.
- Elasticsearch có trong Compose. Đường discovery MongoDB truy vấn collection trực tiếp; nhánh MySQL dùng Elasticsearch khi sẵn sàng và fallback SQL khi cần.
- Transaction đa collection yêu cầu MongoDB deployment hỗ trợ transaction. Dùng replica set/Atlas phù hợp; không suy từ việc server kết nối được rằng mọi workflow transaction đã được kiểm thử.
- Dữ liệu RAG của chatbot nằm trong Chroma/BM25 và cần được đồng bộ riêng. MongoDB ứng dụng không tự tạo đầy đủ chỉ mục vector cho chatbot.

## Kiểm tra được ghi nhận trong nhật ký trước

> Các con số và kết quả trong bảng được ghi ở các phiên trước, không phải kiểm thử lại vào ngày cập nhật tài liệu này.

| Khu vực | Kết quả đã ghi trong nhật ký | Phạm vi còn lại |
|---|---|---|
| Auth | Đăng ký/đăng nhập, refresh, session và một số luồng MFA/password đã smoke trên database test. | Không coi mọi nhánh auth đã được kiểm tra trên mọi topology. |
| Discovery/streaming | Có smoke GET và lịch sử trên MongoDB. | Một số route nội dung cũ và R2 upload cần kiểm tra riêng. |
| Community/admin | Có các smoke riêng cho posts, moderation, points, quests và giao diện. | Không giả định mọi collection/index production đã migration. |
| Watch Party | REST/Socket.IO MongoDB có smoke host/guest. | Cần kiểm tra thêm concurrency, multi-instance và socket deployment. |
| Lensy | CLIP tạo embedding 512 chiều; API CLIP và scan từng được smoke trên test data. | Benchmark self-query không đánh giá nhận diện ảnh crop phim; catalog cần ảnh đúng và query có nhãn. |
| Video | Webhook đã được smoke riêng. | Upload R2 → ffmpeg → video-processor → webhook chưa được xác nhận end-to-end trong các ghi chép này. |

## Kiểm tra gần nhất trong workspace

Sau khi merge nhánh Du, `npm test` chạy với `DATA_STORE=mongodb` và `FRONTEND_ORIGIN=http://localhost:5173` đạt **89/89**; frontend `npm run build` thành công với cảnh báo bundle lớn/dynamic import. Tại lần kiểm tra đó working tree còn thay đổi Lensy chưa commit, trong đó có thêm test; số 89/89 áp dụng cho working tree ấy, không phải bằng chứng rằng remote commit riêng lẻ đã chạy đúng bộ test này.

Không chạy integration smoke ghi database trong lần kiểm tra trên. Các script `backend-node/integration/*` phải được đọc riêng và chạy với database test được xác nhận trước.

## Trước khi tiếp tục migration

1. Lập danh sách endpoint đang được dùng và kiểm tra nhánh MongoDB/MySQL của từng endpoint.
2. Xác nhận database đích, backup/restore và khả năng transaction trước khi chạy thao tác ghi.
3. Tách test DB khỏi database ứng dụng. Không dùng biến test trỏ vào URI production.
4. Kiểm kê dữ liệu, index và validator trên database test; không áp dụng `init-community-schema.js` lên collection đã tồn tại.
5. Kiểm tra luồng R2/video/chatbot riêng; chúng có dependency và dữ liệu index ngoài collection phim chính.
6. Chỉ gỡ MySQL/Prisma sau khi toàn bộ route, script, test và môi trường triển khai đã được chuyển và xác minh.

### Ghi chú lịch sử

Các mục được tổng hợp trước đây ngày 01/11/2026 ghi lại từng bước chuyển trên workspace và Atlas test. Đường dẫn file dump, IP LAN, URI và thông tin truy cập không lưu trong tài liệu hiện tại; không dùng các con số/thử nghiệm cũ làm trạng thái của database ngày hôm nay.
