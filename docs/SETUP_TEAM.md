# Cài đặt Zflix cho thành viên nhóm

Hướng dẫn cho người **clone repo lần đầu**. Nếu bạn đã chạy được rồi thì không cần đọc.

---

## Yêu cầu

| Phần mềm | Bắt buộc? | Ghi chú |
| --- | --- | --- |
| **Node.js** ≥ 20 | ✅ Bắt buộc | https://nodejs.org (bản LTS) |
| **MySQL / MariaDB** | ❌ Tùy chọn | Không có vẫn chạy: script tự tải MariaDB portable |
| **Python** ≥ 3.10 | ❌ Tùy chọn | Chỉ cần khi upload/convert video sang HLS |
| **ffmpeg** | ❌ Tùy chọn | Chỉ cần cho upload video: `winget install Gyan.FFmpeg` |

**Chỉ cần Node.js.** Script cài đặt tự lo database theo 1 trong 3 cách dưới.

---

## Cài đặt: 1 lệnh

```cmd
git clone <repo-url>
cd LTW_zflix-
setup-zflix.bat
start-zflix.bat
```

Mở http://localhost:5173 → đăng nhập `admin@moviehub.com` / `Zflix@2026`.

---

## 3 chế độ database

Script tự chọn chế độ phù hợp, hoặc bạn chỉ định bằng tham số.

### A. Máy đã có MySQL (XAMPP / Laragon / MySQL Server)

Tự phát hiện, không cần làm gì. Script sẽ hỏi mật khẩu user `root`
(XAMPP mặc định để trống → nhấn Enter).

### B. Máy chưa có gì → MariaDB portable (mặc định)

Script tự tải MariaDB 10.11 (~86 MB) về `.localdb/`, giải nén, khởi tạo data dir
và chạy ở **port 3307** (không đụng MySQL nào khác trên máy).

- Không cần quyền admin, không cài vào hệ thống
- Lần đầu mất ~1 phút (tải), các lần sau dùng lại ngay
- `start-zflix.bat` tự bật lại MariaDB portable
- Xoá thư mục `.localdb/` là reset sạch

Ép dùng chế độ này kể cả khi máy có MySQL: `setup-zflix.bat --embedded`

### C. DB dùng chung cho cả nhóm

Một người tạo DB trên cloud (hoặc máy chủ), cả nhóm cùng trỏ vào:

```cmd
setup-zflix.bat --db-url "mysql://user:password@host:3306/movie_streaming_db"
```

> ⚠️ **Chế độ C KHÔNG BAO GIỜ tự nạp lại schema** — vì `init.sql` có 32 câu
> `DROP TABLE` sẽ xoá sạch dữ liệu chung. Script chỉ kiểm tra DB tồn tại rồi
> giữ nguyên. Muốn reset phải gõ đúng tên database để xác nhận.

**Người tạo DB chung** chạy trước (một lần), trên máy có MySQL:

```cmd
setup-zflix.bat
```

rồi chia sẻ connection string cho nhóm.

---

## Script đã làm gì

| Bước | Nội dung |
| --- | --- |
| 1 | Chọn nguồn DB: MySQL sẵn có → MariaDB portable → `--db-url` |
| 2 | Kiểm tra kết nối |
| 3 | Tạo database + import `init.sql` (32 bảng) + `migrate-visual-shopping.sql` (3 bảng) → **35 bảng** |
| 4 | Sinh 3 file `.env` với `JWT_ACCESS_SECRET` + `VIDEO_WEBHOOK_SECRET` **ngẫu nhiên**, ghi đúng mật khẩu MySQL vào `DATABASE_URL` |
| 5 | `npm install`, `prisma generate`, `migrate:auth`, đặt mật khẩu dev |

### Tuỳ chọn

```cmd
setup-zflix.bat --embedded                                  # ép dùng MariaDB portable
setup-zflix.bat --db-url "mysql://u:p@host:3306/db"         # DB dùng chung
setup-zflix.bat --db-password 123456                        # không hỏi mật khẩu root
setup-zflix.bat --force                                     # XOÁ database, nạp lại (MẤT DỮ LIỆU)
setup-zflix.bat --skip-install                              # bỏ qua npm install
setup-zflix.bat --db-name zflix_test                        # DB tên khác (thử nghiệm, KHÔNG đụng .env)
```

> **`.env` an toàn**: script **chỉ** ghi `DATABASE_URL` khi `.env` vừa được tạo
> trong chính lần chạy đó. Nếu `.env` đã tồn tại từ trước, script giữ nguyên
> tuyệt đối — kể cả khi dùng `--force` (vì `--force` nghĩa là xoá *database*,
> không phải xoá *cấu hình*). Muốn đổi thì sửa tay dòng `DATABASE_URL`.

---

## Đăng nhập

| Email | Mật khẩu | Vai trò |
| --- | --- | --- |
| `admin@moviehub.com` | `Zflix@2026` | admin |
| `john.doe@email.com` | `Zflix@2026` | user |

Đổi mật khẩu khác:

```cmd
cd backend-node
npm run db:password -- --password MatKhauCuaBan
npm run db:password -- --password MatKhauCuaBan --include-users   # mọi user local
```

> **Vì sao cần bước này:** 44 tài khoản seed trong `init.sql` dùng chung một hash bcrypt
> nhưng plaintext không có trong repo, nên không thể đăng nhập nếu chưa đặt lại.

---

## Các lệnh thường dùng

```cmd
start-zflix.bat      # bật MariaDB + backend (3000) + video-processor (8001) + frontend (5173)
stop-zflix.bat       # tắt tất cả
```

Log khi có lỗi:

| File | Nội dung |
| --- | --- |
| `backend-node/backend.err` | Lỗi backend Node |
| `backend-node/backend.log` | Log backend |
| `frontend/frontend.err` | Lỗi Vite |
| `backend-node/prisma.log` | Log `prisma generate` |
| `backend-python/video-processor/video.err` | Lỗi video processor |

---

## Lỗi thường gặp

### "Tai MariaDB portable that bai" (chế độ B)

Script cần mạng cho lần tải đầu (~86 MB). Kiểm tra kết nối rồi chạy lại.
Nếu mạng công ty/trường chặn `archive.mariadb.org`, tải thủ công file zip rồi
đặt vào `.localdb/mariadb.zip` trước khi chạy.

Xoá `.localdb/` để thử lại từ đầu.

### "Dang nhap MySQL that bai" (chế độ A)

Sai mật khẩu `root`. Chạy lại với mật khẩu đúng:

```cmd
setup-zflix.bat --db-password MATKHAU_CUA_BAN
```

Hoặc bỏ qua MySQL có sẵn, dùng portable: `setup-zflix.bat --embedded`

### "Database ... khong ton tai" (chế độ C)

DB dùng chung chưa được tạo. Nhờ người tạo DB chạy `setup-zflix.bat` trước,
hoặc kiểm tra lại connection string trong `--db-url`.

### Port 3307 bị chiếm (chế độ B)

Kiểm tra: `netstat -ano | findstr :3307`. Nếu có process khác, tắt nó hoặc
xoá `.localdb/` rồi chạy lại.

### "mysqladmin: connect to server failed" hoặc port 3306 không lên

Port 3306 đang bị chiếm (thường do MySQL cài song song với XAMPP). Kiểm tra:

```cmd
netstat -ano | findstr :3306
```

### Đăng nhập được nhưng vào `/admin` bị đá ra

Tài khoản không có role `admin`. Kiểm tra trong DB:

```sql
SELECT email, role, status FROM users WHERE email = 'admin@moviehub.com';
```

Nếu `role != 'admin'`:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@moviehub.com';
```

### Upload video báo lỗi nhưng server vẫn chạy

Pipeline upload cần **cả 3**: R2 credentials trong `backend-node/.env`, `ffmpeg` trong PATH,
và video-processor ở cổng 8001. Kiểm tra:

```cmd
ffmpeg -version
curl http://127.0.0.1:8001/docs
```

Không có R2 key thì **chỉ luồng upload hỏng** — xem phim, tìm kiếm, admin, Lensy vẫn chạy bình thường.

### ⚠️ `npm run seed:omdb` XOÁ TOÀN BỘ phim cũ

Script này bước ① xoá **mọi** `productions` / `episodes` / `seasons` (chỉ giữ `users`),
rồi nạp lại từ OMDb. Hậu quả:

- **Mất 2 phim demo HLS của nhánh Nam** (`Phim Demo Nam — Lẻ/Bộ (HLS R2)`) vì
  chúng không có trong danh sách OMDb. File video vẫn còn trên R2 nên khôi phục được.
- **Mất mọi phim bạn tự upload** qua trang quản trị.

Sau khi chạy `seed:omdb`, khôi phục phim demo R2:

```cmd
cd backend-node
npm run restore:r2
```

> Trước khi chạy `seed:omdb` trên DB có dữ liệu thật, hãy backup:
> ```cmd
> mysqldump -u root -p movie_streaming_db > backup.sql
> ```

### Phim không phát được (player quay vòng)

Video trên R2 được phát qua proxy backend `/api/v1/hls/*` (vì bucket không cấu hình CORS).
Cần `R2_PUBLIC_DOMAIN` trong `backend-node/.env`. Kiểm tra:

```cmd
curl http://localhost:3000/api/v1/hls/hls/<tên-thư-mục>/playlist.m3u8
```

---

## Cấu hình nâng cao (tuỳ chọn)

Các biến này để trống vẫn chạy được:

| Biến | File | Tác dụng khi có |
| --- | --- | --- |
| `R2_*` (5 biến) | `backend-node/.env` | Upload video lên Cloudflare R2 + phát HLS |
| `ELASTICSEARCH_URL` | `backend-node/.env` | Tìm kiếm full-text; không có thì fallback MySQL `LIKE` |
| `GEMINI_API_KEY` | `backend-node/.env` | Lensy dùng Gemini vision thay vì CLIP local |
| `SERPAPI_KEY` | `backend-node/.env` | Lensy dùng Google Lens thay vì CLIP local |

Xem đầy đủ trong [`backend-node/.env.example`](../backend-node/.env.example) — mỗi biến đều có comment.

> **Không commit file `.env`.** Repo có hook `.githooks/pre-commit` chặn việc này.
> Bật hook trên máy bạn: `git config core.hooksPath .githooks`

---

## Chạy bằng Docker (không cần cài MySQL/Node)

```cmd
copy .env.example .env      :: rồi điền JWT_ACCESS_SECRET
docker compose up --build
```

Lưu ý: `docker-compose.yml` là **development-only** (chạy `npm install && npm run dev` trong container,
mật khẩu DB hardcode). Không dùng cho production.

---

## Cấu trúc database (35 bảng)

`init.sql` tạo 32 bảng, sau đó `migrate-visual-shopping.sql` thêm 3 bảng:

| Nguồn | Số bảng | Gồm |
| --- | --- | --- |
| `database/init.sql` | 32 | productions, episodes, users, auth_sessions, comments, ratings, watch_parties, security_events, … |
| `database/migrate-visual-shopping.sql` | +3 | `visual_products`, `visual_searches`, `affiliate_clicks` |

Sau đó `npm run migrate:auth` thêm cột MFA vào `users` (nếu thiếu) và tạo 3 bảng auth còn lại
(`password_reset_tokens`, `auth_mfa_challenges`, `auth_mfa_recovery_codes` — đã có sẵn trong `init.sql`).

**Đừng chạy `init.sql` trên DB đang có dữ liệu**: file này có 32 câu `DROP TABLE IF EXISTS`.
Script `setup-zflix.bat` tự bỏ qua bước này nếu database đã tồn tại.
