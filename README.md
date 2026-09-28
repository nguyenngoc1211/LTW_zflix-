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