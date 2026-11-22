# Cài đặt Zflix cho thành viên nhóm

Hướng dẫn này bám theo cấu hình MongoDB và Docker Compose hiện có trong repo. Compose không tạo MongoDB hay nạp dữ liệu mẫu; bạn cần một database Zflix đã được chuẩn bị.

## Yêu cầu

- Git.
- Docker Desktop đang chạy nếu dùng Compose.
- MongoDB có thể truy cập được và có dữ liệu Zflix. Dùng deployment hỗ trợ transaction vì một số nghiệp vụ phụ thuộc vào transaction đa collection.
- Node.js 22 nếu chạy backend hoặc frontend trực tiếp.
- R2 và ffmpeg chỉ cần cho upload video/HLS. Elasticsearch và các biến AI chỉ cần cho chức năng tương ứng.

## Lấy source

```powershell
git clone -b integration https://github.com/nguyenngoc1211/LTW_zflix-.git
Set-Location LTW_zflix-
```

## Chạy bằng Docker Compose

Tạo file cấu hình local:

```powershell
Copy-Item .env.example .env
```

Mở `.env` và điền ít nhất:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/
MONGODB_DB_NAME=<database>
JWT_ACCESS_SECRET=<random-secret-at-least-32-characters>
FRONTEND_ORIGIN=http://localhost:5173
```

Tạo secret bằng PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Khởi động stack:

```powershell
docker compose up --build
```

Mở `http://localhost:5173`. Backend health ở `http://localhost:3000/`. Service bổ sung: Elasticsearch `:9200`, video-processor `:8001`, chatbot `:8002`.

Compose chỉ cấu hình ứng dụng phát triển. Nó không có MongoDB service, không tạo collection/dữ liệu phim, và không dành cho triển khai production. Nếu frontend mở bằng hostname/IP khác, thêm origin chính xác vào `FRONTEND_ORIGIN` trong `.env` rồi tạo lại backend.

## Chạy frontend/backend không dùng Compose

Backend đọc `backend-node/.env`. Tạo từ mẫu rồi điền `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_ACCESS_SECRET`, `FRONTEND_ORIGIN` và `DATA_STORE=mongodb`:

```powershell
Copy-Item backend-node/.env.example backend-node/.env
Set-Location backend-node
npm ci
npm run dev
```

Trong terminal khác:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Frontend tự suy ra API cùng hostname trên cổng `3000`. Nếu API nằm ở host khác, đặt `VITE_API_URL` trong `frontend/.env`.

Source vẫn giữ các nhánh MySQL cũ. Một số module chưa chuyển hoàn toàn có thể cần `DATABASE_URL`; kiểm tra module/route cụ thể trước khi bật cấu hình lai. Không chạy migration hoặc test ghi trên database chính nếu chưa xác nhận phạm vi.

## Python services

Compose khởi chạy video-processor và AI chatbot cùng backend. Chatbot cần `GEMINI_API_KEY`; ở lần đầu, model và chỉ mục RAG có thể cần tải/được chuẩn bị. API chatbot hiện mount `POST /api/v1/chat`; ingestion là thao tác nội bộ được gọi bằng code/lệnh theo service, không nên mở công khai nếu chưa có lớp bảo vệ triển khai.

Video-processor cần các biến R2 và `VIDEO_WEBHOOK_SECRET` khớp với backend. Upload video cũng cần ffmpeg. Không cấu hình các biến này thì các trang không dùng upload vẫn có thể chạy.

## Lensy và CLIP

Mặc định `VISION_PROVIDER=none`; `/api/v1/scan` dùng CLIP để tìm trong catalog local. Nếu đặt `VISION_PROVIDER=deepseek` và có `DEEPSEEK_API_KEY`, `/scan` dùng nhận diện DeepSeek rồi tìm marketplace theo từ khóa. `/api/v1/visual-search` là endpoint CLIP riêng.

Script tạo embedding từ CSV:

```powershell
Set-Location backend-node
npm run catalog:index
```

Script đọc `data/products.sample.csv` mặc định, tải ảnh và ghi embedding vào MongoDB. Import CSV bằng API catalog chỉ ghi dữ liệu sản phẩm, không tự tạo embedding. Catalog mẫu có hình ảnh demo, cần kiểm tra ảnh và dữ liệu trước khi dùng để đánh giá nhận diện.

## Tài khoản và dữ liệu

Không giả định một MongoDB mới có sẵn tài khoản demo hoặc dữ liệu phim. Repo không có một lệnh bootstrap duy nhất để khởi tạo đầy đủ mọi collection và dữ liệu nghiệp vụ MongoDB. Dùng database test đã được nhóm chuẩn bị hoặc hỏi người quản trị dự án về quy trình seed được phê duyệt.

Không dùng `npm run db:password` cho MongoDB: lệnh đó thuộc đường MySQL legacy. Không tự chạy các script `seed-*` trên database chính nếu chưa đọc guard và xác nhận đúng database đích.

## Kiểm tra cơ bản

```powershell
Set-Location backend-node
$env:DATA_STORE='mongodb'
$env:FRONTEND_ORIGIN='http://localhost:5173'
npm test
```

```powershell
Set-Location frontend
npm run lint
npm run build
```

Các script `integration/*-smoke.js` có thể tạo dữ liệu và cần database test riêng. Đọc hướng dẫn đầu file và kiểm tra URI/tên database trước khi chạy.

## Tài liệu liên quan

- [README](../README.md)
- [Cấu trúc source](PROJECT_STRUCTURE.md)
- [Deploy](DEPLOYMENT.md)
- [Tiến độ MongoDB](MONGODB_MIGRATION_PROGRESS.md)
- [Auth/Security](AUTH_SECURITY_PROGRESS.md)
