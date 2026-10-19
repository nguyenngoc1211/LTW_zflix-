# 🎬 Movie Streaming Platform

Hệ thống xem phim trực tuyến xây dựng theo kiến trúc Modular Monorepo, gồm React,
Express, MySQL, Elasticsearch và hai service Python.

## ✨ Module trên branch `Hai`

- Tìm kiếm phim bằng Elasticsearch, không phân biệt chữ hoa/chữ thường.
- Lọc kết hợp theo thể loại, quốc gia, năm phát hành và rating; sắp xếp theo năm.
- Trang danh sách, chi tiết phim, tập phim và trình phát.
- Yêu thích, quan tâm phim mới và nhận thông báo khi có tập mới.
- Lịch sử xem, lưu vị trí đang xem và tiếp tục phát.
- Rating 1–5 sao, điểm trung bình và bình luận.
- Kiểm tra ownership từ `req.user.id`; không nhận `userId` do client khai báo.

Tài liệu:

- [Cài đặt, vận hành và merge với branch Du](docs/HAI_MODULES_GUIDE.md)
- [Danh sách API](docs/HAI_API_REFERENCE.md)
- [Kết quả build và kiểm thử](docs/HAI_TEST_REPORT.md)

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
git clone --branch Hai https://github.com/nguyenngoc1211/LTW_zflix-.git
cd LTW_zflix-
```

### Bước 2: Khởi động hệ thống
Mở Docker Desktop lên, sau đó chạy lệnh:
```bash
docker compose up -d
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
| **Elasticsearch** | `http://localhost:9200` | Tìm kiếm và lọc phim |
| **Database** | `localhost:3306` | MySQL (User: `root` / Pass: `rootpassword`) |

---

## 👨‍💻 Quy trình làm việc (Workflow)

> Module tìm kiếm, thư viện, lịch sử, đánh giá và thông báo của branch Hai: xem [docs/HAI_MODULES_GUIDE.md](docs/HAI_MODULES_GUIDE.md).

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
