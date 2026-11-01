# Tiến độ chuyển Zflix sang MongoDB

## Cập nhật cấu hình phát triển ngày 2026-11-01

- Theo yêu cầu dùng MongoDB, `docker-compose.yml` không còn khai báo service MySQL, không chạy Prisma generate hoặc migration MySQL khi khởi động; backend nhận `DATA_STORE=mongodb`, `MONGODB_URI`, `MONGODB_DB_NAME` từ cấu hình. Chưa xóa Docker volume MySQL hay dữ liệu MongoDB.
- Hai file `.env` local đã đặt `DATA_STORE=mongodb`; các file `.env.example` hướng dẫn biến MongoDB. Không ghi URI hoặc thông tin đăng nhập vào Git.
- Đã kiểm tra `docker compose config --quiet`, 69/69 backend unit tests và smoke test schema/posts trên `community_test_schema_20261101`; chưa thử chạy Docker stack hoặc toàn bộ luồng auth trên MongoDB. Docker CLI cảnh báo không đọc được cấu hình người dùng, dù lệnh kiểm tra cấu hình trả mã thành công.
- Việc chuyển hoàn toàn **chưa xong**: source, scripts, tests và dependency MySQL/Prisma vẫn còn; chưa gỡ hoặc coi các nhánh này đã được thay thế. Cần kiểm tra các script vận hành và kiểm thử từng module trên database test trước khi loại bỏ.
- Đã chuyển script `catalog:index` và `benchmark:visual` khỏi truy vấn MySQL sang collection `visual_products` của MongoDB. Integration test trên database test riêng xác nhận tạo sản phẩm, kiểu dữ liệu và bỏ qua tên trùng; fixture đã xóa, bộ đếm ID test có thể tăng. Chưa thử toàn bộ pipeline tải ảnh/CLIP hoặc benchmark với catalog thật; việc kiểm tra trùng tên chưa được bảo đảm nguyên tử giữa nhiều tiến trình.

Cập nhật: 2026-11-01. Tài liệu này ghi lại **mã đang có trong working tree**, chưa phải bản đã commit hoặc triển khai. Khi tài liệu và source khác nhau, đọc source trước.

## Mục tiêu và dữ liệu

- Mục tiêu đã thống nhất: chuyển toàn bộ ứng dụng sang MongoDB Atlas, giữ ID và quan hệ của dữ liệu MySQL; giữ MySQL chạy song song trong giai đoạn chuyển đổi.
- Dữ liệu nguồn là `C:\Users\ADMIN\Downloads\mysql-20261031-235444\movie_streaming_db.sql`. Lần nhập trước đã tạo 35 collection, 1.062 document trong database Atlas `Zflix`. Đã đối chiếu 10.416 field và 1.413 tham chiếu khóa ngoại; tên field MongoDB khớp tên cột SQL. SHA-256 của dump: `28F7C680AB94C39457EAA253D4D476A7360FC6036FDE1769ED0094161E26A22B`.
- URI Atlas và khóa bí mật nằm trong các file `.env` không theo dõi bằng Git. Không ghi URI hoặc mật khẩu vào tài liệu này.

## Cấu trúc chuyển đổi hiện tại

- `backend-node/src/core/database/mongo.js` quản lý kết nối, collection, chuyển Decimal128 sang chuỗi khi trả JSON, cấp ID số tiếp nối dữ liệu nhập, transaction.
- `DATA_STORE=mongodb` chọn các nhánh MongoDB đã triển khai; MySQL/Prisma vẫn còn trong source để chuyển dần. `backend-node/src/core/database/pool.js` trả `null` nếu không có `DATABASE_URL`, nên route chưa chuyển sẽ trả 500 khi gọi `pool.execute` hoặc `pool.getConnection`.
- Đã thêm dependency `mongodb` vào `backend-node/package.json` và lockfile. `npx prisma generate` đã chạy để khôi phục Prisma client cho mã cũ.
- Root `.env` local đã cho phép frontend origin `localhost:5173`, `127.0.0.1:5173`, `192.168.1.181:5173`. Đây là cấu hình trên máy, không có trong commit.

## Backend đã sửa

| Nhóm | Phần MongoDB đã thêm | Mức kiểm tra |
| --- | --- | --- |
| Auth/security | Đăng ký, đăng nhập, refresh rotation, session, MFA, đổi/đặt lại mật khẩu, auth middleware, security events, dọn dữ liệu auth | Luồng đăng ký → đăng nhập → refresh → revoke trên DB Atlas thử nghiệm riêng; BSON MFA giải mã đúng. Chưa kiểm thử đầy đủ mọi nhánh MFA/password reset. |
| Discovery | Lọc, tìm kiếm, gợi ý, chi tiết phim, tập và phim nổi bật | GET API công khai trả 200 với dữ liệu `Zflix`. |
| Streaming | Quyền phát VIP, chi tiết tập, lịch sử xem | GET tập trả 200; ghi/đọc lịch sử qua DB thử nghiệm trả 200. |
| Community | Yêu thích, quan tâm, đánh giá, bình luận, thông báo | GET đánh giá/bình luận trên `Zflix` trả 200; các thao tác ghi chính trên DB thử nghiệm thành công. |
| Admin cơ bản | Dashboard stats, người dùng, phim, views, đổi quyền/trạng thái, đổi trạng thái/VIP phim | GET và PATCH phim trên DB thử nghiệm trả 200. |
| Admin nội dung | Tạo/sửa/xóa phim, thể loại, tập, thông báo tập mới | CRUD phim/tập và xóa phim sau khi dọn liên kết thể loại đã thử trên DB thử nghiệm. |
| Admin moderation | Danh sách/xóa bình luận, đánh giá, gửi thông báo, reindex | Đã kiểm tra cú pháp; chưa thử tích hợp đầy đủ. |
| Admin system | Phòng xem chung, gói VIP, cấp VIP, nhật ký bảo mật, CSV, phim nổi bật | GET, cấp VIP, cài đặt và xuất CSV trên DB thử nghiệm trả 200. |
| Shopping | Sản phẩm theo phim, match theo thời điểm, click mua, CRUD sản phẩm, snapshot | Tạo/xem/match/xóa sản phẩm và snapshot trên DB thử nghiệm thành công. |
| Watch Party | REST tạo/xem/tham gia/rời phòng, chat, playback, cài đặt/thành viên; Socket.IO xác thực MongoDB session, join, chat, sync, phân quyền host | REST và Socket.IO đã thử với host/guest trên DB Atlas riêng; guest không thể join socket trước khi tham gia REST và không thể tự phát lệnh kick. |
| Streaming service cũ dùng Prisma | Đã thêm MongoDB cho GET danh sách/phổ biến/chi tiết/thể loại/tập theo mùa, tạo/sửa/xóa phim bộ, mùa và tập | GET trên dữ liệu `Zflix` trả 200; tạo → sửa → xóa phim bộ/mùa/tập qua API trên DB Atlas riêng thành công. Upload video thật lên R2 chưa thử. |
| Lensy/visual shopping | Catalog, chi tiết sản phẩm, affiliate click, lịch sử tìm kiếm, import và tạo catalog dùng MongoDB; vector index có đường cosine JavaScript khi HNSW native không có | GET stats/chi tiết trả 200 trên `Zflix`. Model CLIP vision tạo embedding 512 chiều; POST `/api/v1/visual-search` và `/api/v1/scan` trả 200, ghi 2 lịch sử trên DB Atlas thử nghiệm riêng, đã xóa DB. Ảnh thử không đạt ngưỡng tương đồng nên kết quả 0 sản phẩm; chưa kiểm chứng chất lượng nhận dạng. |
| Webhook video | Cập nhật `episodes.video_url` và `productions.status` bằng MongoDB transaction | Thiếu secret trả 401, secret thử nghiệm trả 200 và URL tập được cập nhật trên DB Atlas thử nghiệm; đã xóa DB. Chưa thử Python/R2 thật. |

Database thử nghiệm Atlas được đặt tên riêng, kiểm tra tên trước thao tác dọn và đã xóa sau mỗi lần chạy thành công. Không dùng tài khoản hay dữ liệu thật để kiểm thử ghi.

## Kiểm tra chạy ứng dụng

- Docker Desktop không có daemon hoạt động trong lần thử, nên đã chạy Node backend và Vite frontend trực tiếp.
- `backend-python/video-processor/.env` chưa có trên máy, nên chưa thể thử chuỗi upload và xử lý video qua R2/Python. File `.env.example` chỉ chứa tên biến cấu hình.
- Frontend `npm run build` thành công sau `npm ci`; backend `npm test` đạt 61/61 test hiện có. Bộ test cũ chủ yếu kiểm tra đường MySQL/validation, **không chứng minh toàn bộ MongoDB hoạt động**.
- Với backend chạy `DATA_STORE=mongodb`, API `/`, `/api/v1/filters`, `/api/v1/productions?limit=5`, `/api/v1/productions/1`, `/api/v1/episodes/1` và bình luận phim trả 200. CORS preflight từ ba local origin nêu trên trả 204 và có `Access-Control-Allow-Origin` phù hợp.
- Các lần chạy ban đầu có lỗi sau đăng nhập: log ghi `pool` là `null` tại Watch Party/Admin/Shopping và service Prisma ghi thiếu `DATABASE_URL`. Sau khi chuyển thêm Watch Party và service phim/tập rồi khởi động lại backend, `GET /api/v1/watch-party`, `/api/streaming/productions/popular`, `/api/streaming/productions/list`, `/api/v1/shopping/productions/1/products` và trang frontend đều trả 200. Các tiến trình backend mở trước khi sửa source **không tự nạp mã mới**.
- Sau khi sửa Lensy và khởi động lại backend MongoDB, `/`, `/api/v1/visual-search/stats`, `/api/v1/scan/products/1`, `/api/v1/watch-party`, `/api/streaming/productions/list` và frontend `http://127.0.0.1:5173/` đều trả 200. `npm test` vẫn đạt 61/61 và frontend build thành công; chưa kết luận tất cả chức năng giao diện đã hoạt động chỉ từ các HTTP smoke này.
- Lỗi bấm “Xem phim” trả `R2 public domain is not configured` do `R2_PUBLIC_DOMAIN` vắng ở `.env` local, dù 62 URL video trong Atlas cùng dùng một host R2 public. Đã thêm đúng host đó vào `backend-node/.env` (không commit), khởi động lại backend và thử một tập miễn phí: API tập 200, playlist HLS proxy 200, segment video đầu 200. Chưa thử trực quan player hoặc mọi tập.
- Công cụ trình duyệt trong phiên không có browser khả dụng; mới xác nhận frontend qua build và HTTP, chưa xác nhận trực quan toàn bộ luồng UI.

## Chưa hoàn thành

1. Kiểm thử upload video thật lên R2/Python service, phim lẻ, Admin moderation, Auth MFA/password reset và quan hệ/cascade dữ liệu trên database thử nghiệm. Webhook đã thử độc lập, chưa thử chuỗi upload → xử lý Python → webhook. Watch Party Socket.IO đã kiểm thử host/guest cơ bản, chưa thử mọi tình huống đồng thời.
2. Khởi động lại backend với source mới, chạy smoke UI thật cho các trang sau đăng nhập; chỉ bật MongoDB mặc định khi không còn route quan trọng phụ thuộc MySQL/Prisma.
3. Lensy đã chạy API quét nhưng còn cần đánh giá ngưỡng tương đồng với ảnh sản phẩm thật. Máy hiện tại thiếu binding `hnswlib-node`, nên index đang dùng cosine JavaScript; phù hợp catalog nhỏ hiện tại, cần đo hiệu năng khi catalog tăng.

## Git và cách tiếp tục

- Branch: `Du`, đang ahead `origin/Du` 79 commit tại lần kiểm tra này. Các thay đổi chuyển MongoDB **chưa commit, chưa push**. Không đẩy thẳng lên `main`.
- `docs/AUTH_SCOPE_STATUS.md` là file untracked có sẵn từ trước, giữ nguyên.
- Trước khi sửa auth/authorization: đọc `docs/AUTH_SECURITY_PROGRESS.md`, chạy `git status`, `git log --oneline -10`, đọc source hiện tại; sau mỗi phase auth/security cập nhật tài liệu đó theo `AGENTS.md`.
- Để chạy backend MongoDB local cần `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_ACCESS_SECRET` trong môi trường và đặt `DATA_STORE=mongodb`; không in giá trị bí mật ra log. MySQL local có service đang chạy nhưng chưa có `DATABASE_URL`/thông tin đăng nhập trong `.env` của project.
