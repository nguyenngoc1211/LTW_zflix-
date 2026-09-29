# 🎬 Movie Streaming Platform

Hệ thống xem phim trực tuyến (Rophim Clone) xây dựng theo kiến trúc Modular Monorepo.

## 🚀 Yêu cầu cài đặt (Prerequisites)

Để chạy dự án này, máy bạn **CHỈ CẦN** cài đặt:
1. **Docker Desktop** (Bắt buộc) - [Tải tại đây](https://www.docker.com/products/docker-desktop/)
2. **Git**
3. **VS Code** (Khuyên dùng)

> ⚠️ **Lưu ý:** Bạn **KHÔNG CẦN** cài Node.js, Python hay MySQL lên máy thật. Docker sẽ lo hết.

---

## 🛠️ Hướng dẫn chạy dự án (Quick Start)

### Bước 1: Clone mã nguồn
Mở Terminal (hoặc Git Bash) và chạy:
```bash
git clone <LINK_GITHUB_CUA_NHOM_O_DAY>
cd CNPM
```

### Bước 2: Khởi động hệ thống
Mở Docker Desktop lên, sau đó chạy lệnh:
```bash
docker compose up
```

Nếu là lần đầu tiên chạy hoặc vừa cài thêm thư viện mới, hãy dùng lệnh:
```bash
docker compose up --build
```

⏳ **Chờ khoảng 5-10 phút** cho lần chạy đầu tiên để Docker tải và cài đặt môi trường. Khi thấy dòng `Server running...` hoặc `Ready for connections` là thành công.

---

## 🌐 Truy cập hệ thống

Sau khi khởi động xong, bạn có thể truy cập các dịch vụ tại:

| Service | URL | Mô tả |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:5173` | Trang web chính (React) |
| **Backend Node** | `http://localhost:3000` | API chính (Express) |
| **Video Service** | `http://localhost:8001` | Xử lý video (Python) |
| **AI Service** | `http://localhost:8002` | Chatbot & Gợi ý (Python) |
| **Database** | `localhost:3306` | MySQL (User: `root` / Pass: `rootpassword`) |

---

## 🔐 Đăng nhập và phân quyền

Tài khoản mẫu sau được tạo từ `database/init.sql`. Mật khẩu trong MySQL được lưu dưới dạng bcrypt. **Các tài khoản này chỉ dành cho local/development; không chạy file seed này trong production.**

| Quyền | Email | Mật khẩu |
| :--- | :--- | :--- |
| Admin | `admin@moviehub.com` | `abc123` |
| User | `john.doe@email.com` | `abc123` |

Các endpoint xác thực dùng base path `/api/v1/auth`:

- `POST /login`: đăng nhập bằng email và mật khẩu.
- `POST /refresh-token`: xoay refresh token từ cookie HTTP-only.
- `GET /me`: lấy người dùng hiện tại bằng Bearer access token.
- `POST /logout`: thu hồi phiên và xóa refresh cookie.
- `GET /api/v1/admin/check`: endpoint kiểm tra quyền admin.

Access token chỉ nên giữ trong bộ nhớ frontend. Refresh token nằm trong cookie HTTP-only và database chỉ lưu SHA-256 hash của token. Chạy `npm test` trong `backend-node` để kiểm tra API cơ bản, `npm run test:integration` để kiểm tra auth với MySQL đang chạy, và `npm run test:ui` trong `frontend` để kiểm tra luồng trình duyệt bằng Chrome cục bộ.

---

## 👨‍💻 Quy trình làm việc (Workflow)

### 1. Code hàng ngày
* **Frontend/Node.js:** Code có tính năng **Hot Reload**. Bạn cứ sửa file và Save (`Ctrl+S`), web sẽ tự cập nhật ngay lập tức mà không cần chạy lại Docker.
* **Database:** Dữ liệu được lưu trong thư mục `database/init.sql` và volume docker.

### 2. Cài thêm thư viện mới
Nếu bạn cần cài thêm gói (ví dụ `axios` cho frontend), hãy làm như sau:
1. Mở Terminal máy thật, vào thư mục tương ứng (vd: `cd frontend`).
2. Chạy `npm install axios` (để update file package.json).
3. Quay ra root và chạy lại Docker:
    ```bash
    docker compose up --build
    ```

### 3. Lưu ý cho VS Code (Để code sướng hơn)
Mặc dù Docker đã chạy project, nhưng để VS Code trên máy thật không báo lỗi đỏ lòm và có gợi ý code thông minh, bạn nên chạy lệnh cài đặt **chỉ để lấy node_modules ảo**:

```bash
cd frontend && npm install
cd ../backend-node && npm install
```
*(Bước này chỉ làm 1 lần khi mới clone về)*
