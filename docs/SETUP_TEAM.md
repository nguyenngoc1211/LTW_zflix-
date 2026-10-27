# Cài đặt Zflix cho thành viên nhóm

Hướng dẫn cho người **clone repo lần đầu**. Nếu bạn đã chạy được rồi thì không cần đọc.

---

## Yêu cầu

| Phần mềm | Phiên bản | Ghi chú |
| --- | --- | --- |
| **Node.js** | ≥ 20 (khuyến nghị 22 LTS) | https://nodejs.org |
| **MySQL / MariaDB** | MySQL 8.0 **hoặc** MariaDB ≥ 10.8 | Dễ nhất: [XAMPP](https://www.apachefriends.org) (kèm MariaDB 10.4) |
| **Python** | ≥ 3.10 | Chỉ cần nếu muốn upload/convert video sang HLS |
| **ffmpeg** | bất kỳ | Chỉ cần cho upload video: `winget install Gyan.FFmpeg` |

> **MariaDB 10.4 (XAMPP) vẫn chạy được**: script cài đặt tự chuyển collation
> `utf8mb4_0900_ai_ci` → `utf8mb4_unicode_ci` khi import `init.sql`.

---

## Cài đặt: 1 lệnh

```cmd
git clone <repo-url>
cd LTW_zflix-
setup-zflix.bat
```

Script sẽ hỏi **mật khẩu user `root` của MySQL** (XAMPP mặc định để trống → nhấn Enter).

Sau khi xong:

```cmd
start-zflix.bat
```

Mở http://localhost:5173 → đăng nhập `admin@moviehub.com` / `Zflix@2026`.

### Script đã làm gì

| Bước | Nội dung |
| --- | --- |
| 1 | Tìm `mysql.exe` trong XAMPP / Laragon / MySQL Server / PATH |
| 2 | Kiểm tra kết nối bằng user `root` |
| 3 | Tạo database `movie_streaming_db` + import `init.sql` (32 bảng) + `migrate-visual-shopping.sql` (3 bảng) → **35 bảng** |
| 4 | Sinh 3 file `.env` với `JWT_ACCESS_SECRET` + `VIDEO_WEBHOOK_SECRET` **ngẫu nhiên**, ghi đúng mật khẩu MySQL vào `DATABASE_URL` |
| 5 | `npm install`, `prisma generate`, `migrate:auth`, đặt mật khẩu dev |

### Tuỳ chọn

```cmd
setup-zflix.bat --db-password 123456        # không hỏi, dùng mật khẩu này
setup-zflix.bat --force                     # XOÁ database cũ, làm lại từ đầu (MẤT DỮ LIỆU)
setup-zflix.bat --skip-install              # bỏ qua npm install (đã cài rồi)
setup-zflix.bat --db-name zflix_test        # dùng database tên khác (để thử nghiệm)
```

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

### "Khong tim thay mysql.exe"

Chưa cài MySQL, hoặc XAMPP cài ở ổ khác. Script tìm ở:
`C:\xampp\mysql\bin\`, `C:\laragon\...`, `C:\Program Files\MySQL\...`, rồi tới `PATH`.

Cài XAMPP: https://www.apachefriends.org → mở XAMPP Control Panel → **Start** MySQL.

### "Dang nhap MySQL that bai"

Sai mật khẩu `root`. Chạy lại với mật khẩu đúng:

```cmd
setup-zflix.bat --db-password MATKHAU_CUA_BAN
```

Quên mật khẩu root? Mở XAMPP Control Panel → MySQL → **Config** → `my.ini`, hoặc
reset bằng `mysqld --skip-grant-tables`.

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
