# 🎬 Zflix - Watching Party (Module Xem Phim Chung)

> **Dự án Bài tập lớn Lập trình Web**  
> **Sinh viên thực hiện:** Khoa  
> **Công nghệ:** React (Vite, TailwindCSS), Node.js (Express, Socket.IO), MySQL 8.0, Docker

Hệ thống xem phim trực tuyến cùng bạn bè theo thời gian thực (**Real-time Watch Party**), cho phép nhiều người xem cùng một bộ phim, đồng bộ hóa thao tác phát/dừng/tua video và trò chuyện trực tiếp qua Socket.IO.

---

## ✨ Các tính năng nổi bật của Module

### 1. 🍿 Tạo & Tham gia phòng xem phim
- **Tạo phòng linh hoạt:** Chọn phim/tập phim từ cơ sở dữ liệu, đặt tên phòng, thiết lập giới hạn người tham gia (2–50 người).
- **Bảo mật phòng:** Hỗ trợ đặt mật khẩu phòng xem riêng tư hoặc để công khai.
- **Mã phòng độc nhất:** Mỗi phòng có một mã định danh ngẫu nhiên (VD: `#ABC123`) dễ dàng sao chép và chia sẻ cho bạn bè.
- **Vào nhanh bằng mã:** Ô nhập mã phòng trực tiếp ngay trên trang chủ để vào phòng tức thì.

### 2. ⚡ Đồng bộ phát Video thời gian thực (Real-time Video Sync)
- **Đồng bộ đa chiều:** Khi **Host** thao tác (Play, Pause, Tua thời gian, Lùi 10s, Tiến 10s), toàn bộ các thành viên khác trong phòng sẽ tự động phát/tạm dừng và nhảy đến đúng phân cảnh đó qua Socket.IO.
- **Nút "Khớp video":** Thành viên có nút yêu cầu đồng bộ lại tức thì nếu đường truyền mạng cá nhân bị lag/trễ hình.
- **Stream video CDN chuẩn:** Tích hợp sẵn link video MP4 phát trực tuyến tốc độ cao, hỗ trợ tự động phục hồi nếu video nguồn lỗi.

### 3. 💬 Trò chuyện trực tuyến (Live Chat)
- Chat real-time trong phòng xem qua Socket.IO namespace riêng biệt `/watch-party`.
- **Gắn kèm Video Timestamp:** Mỗi tin nhắn tự động hiển thị thời điểm video đang chiếu (VD: `[01:45]`) giúp bình luận đúng ngữ cảnh phân đoạn phim.
- **Tin nhắn hệ thống tự động:** Thông báo khi có thành viên vào phòng, rời phòng, bị tắt tiếng, hoặc khi Host kết thúc phòng.

### 4. 👑 Phân quyền & Quản trị phòng xem (Host Controls)
- **Phân cấp 3 vai trò rõ ràng:**
  - 👑 **Host (Chủ phòng):** Toàn quyền điều khiển video, cài đặt phòng, quản lý thành viên, đóng phòng.
  - ⭐ **Co-Host (Phó phòng):** Được Host cấp quyền điều khiển Play/Pause/Tua video cùng Host.
  - 👤 **Thành viên (Participant):** Xem phim đồng bộ và tham gia trò chuyện.
- **Công cụ quản trị dành cho Host:**
  - 🔇 **Tắt tiếng (Mute/Unmute):** Chặn quyền chat của thành viên vi phạm.
  - ⭐ **Thăng cấp / Hạ cấp:** Gán quyền Co-Host cho bạn bè.
  - 🚫 **Kick thành viên:** Đẩy người dùng ra khỏi phòng ngay lập tức.

### 5. 👥 Menu chuyển đổi tài khoản Test (Multi-user Switcher)
- Tích hợp sẵn menu chọn tài khoản test trên thanh Navbar (`Admin`, `John Doe`, `Jane Smith`...).
- Giúp bạn mở **2 tab trình duyệt song song** (1 tab Host, 1 tab Khách) để test tính năng đồng bộ video và chat cực kỳ dễ dàng mà không cần đăng nhập/đăng xuất phức tạp.

---

## 🚀 Hướng dẫn khởi chạy dự án

### 👉 CÁCH 1: Khởi chạy bằng Docker (Khuyên dùng)

Máy bạn chỉ cần cài đặt **Docker Desktop** (không cần cài thêm Node.js hay MySQL lên máy thật).

1. Mở ứng dụng **Docker Desktop** trên Windows.
2. Mở Terminal tại thư mục `LTW_zflix--Khoa` và chạy:
   ```bash
   docker compose up --build
   ```
   *(Để chạy ngầm dưới nền, thêm cờ `-d`: `docker compose up -d`)*
3. Đợi Docker build và khởi động các container. Khi màn hình hiện trạng thái sẵn sàng, truy cập web tại:
   👉 **http://localhost:5173**

---

### 👉 CÁCH 2: Chạy trực tiếp bằng Node.js & MySQL (Không dùng Docker)

#### Bước 1: Khởi động Database MySQL
1. Mở **XAMPP** (bật module MySQL) hoặc dịch vụ MySQL cục bộ tại cổng `3306`.
2. Tạo database tên `movie_streaming_db` và import file `database/init.sql`.

#### Bước 2: Chạy Backend Node.js
Mở Terminal 1:
```bash
cd backend-node
npm install
npm run dev
```
*(Server chạy tại `http://localhost:3000` và Socket.IO sẵn sàng)*

#### Bước 3: Chạy Frontend React
Mở Terminal 2:
```bash
cd frontend
npm install
npm run dev
```
*(Giao diện web chạy tại `http://localhost:5173`)*

---

## 🌐 Danh mục dịch vụ & Cổng truy cập

| Dịch vụ | Địa chỉ | Công nghệ / Ghi chú |
| :--- | :--- | :--- |
| **Frontend Web** | [http://localhost:5173](http://localhost:5173) | React 19, Vite, TailwindCSS, Socket.IO Client |
| **Backend API** | [http://localhost:3000](http://localhost:3000) | Express 5, Node.js, Socket.IO Server |
| **Socket.IO Namespace** | `http://localhost:3000/watch-party` | Kênh kết nối WebSocket phòng xem phim |
| **Database** | `localhost:3306` | MySQL 8.0 (User: `root` / Pass: `rootpassword` trên Docker) |

---

## 📡 Danh sách REST API & Socket Events (Báo cáo kỹ thuật)

### 1. REST API Endpoints (`/api/v1`)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/watch-party` | Public | Lấy danh sách các phòng đang mở (hỗ trợ tìm kiếm `?q=`) |
| `POST` | `/watch-party` | Authenticated | Tạo phòng xem mới (chọn phim, mật khẩu, số người) |
| `GET` | `/watch-party/:partyId` | Public | Xem thông tin chi tiết phòng, danh sách người xem, lịch sử chat |
| `POST` | `/watch-party/:partyId/join` | Authenticated | Tham gia phòng (kiểm tra mật khẩu, giới hạn người) |
| `POST` | `/watch-party/:partyId/leave` | Authenticated | Rời phòng (Host rời thì phòng tự kết thúc) |
| `PATCH` | `/watch-party/:partyId/playback`| Host / Co-Host | Cập nhật vị trí phát (`currentPosition`) và trạng thái (`isPlaying`) |
| `POST` | `/watch-party/:partyId/chat` | Authenticated | Gửi tin nhắn chat vào phòng kèm timestamp |
| `PATCH` | `/watch-party/:partyId/participants/:userId` | Host | Quản trị thành viên: `mute`, `unmute`, `promote`, `demote`, `kick` |
| `PATCH` | `/watch-party/:partyId/settings` | Host | Thay đổi cài đặt phòng (tên phòng, bật/tắt chat, số lượng tối đa) |
| `GET` | `/watch-party/my-parties` | Authenticated | Lấy danh sách phòng người dùng đang tham gia |
| `GET` | `/watch-party-episodes` | Public | Danh sách phim & tập phim có sẵn để chọn tạo phòng |
| `GET` | `/watch-party-users` | Public | Danh sách tài khoản mẫu hỗ trợ chuyển đổi test |

### 2. Socket.IO Events (`/watch-party`)
* **Client gửi lên Server:**
  * `join-party`: Tham gia vào room Socket theo mã `partyId`.
  * `leave-party`: Rời khỏi room Socket.
  * `sync-playback`: Host gửi lệnh đồng bộ vị trí video và play/pause tới toàn bộ phòng.
  * `request-sync`: Người xem yêu cầu nhận lại trạng thái video hiện tại từ Host.
  * `chat-message`: Gửi tin nhắn real-time và broadcast cho mọi người.
  * `participant-action`: Host broadcast hành động quản lý (kick, mute, promote).
  * `end-party`: Host đóng phòng xem.
* **Server phản hồi tới Client:**
  * `party-joined` / `party-left`: Thông báo có người vào/ra phòng.
  * `playback-sync`: Nhận dữ liệu điều khiển video từ Host để tự động đồng bộ.
  * `new-chat`: Nhận tin nhắn chat mới tức thời.
  * `participant-updated`: Cập nhật trạng thái bị mute hoặc nâng quyền.
  * `party-ended`: Báo hiệu phòng đã kết thúc và tự động đưa người xem về trang chủ.

---

## 🎯 Kịch bản Demo thực tế (Dành cho báo cáo & chấm điểm)

1. **Bước 1 (Mở Tab 1 - Host):**
   - Vào [http://localhost:5173](http://localhost:5173), kiểm tra góc phải Navbar đang là tài khoản `admin`.
   - Bấm **+ Tạo phòng** -> Chọn phim *The Dark Knight* -> Bấm **Khởi tạo phòng ngay**.
   - Copy mã phòng hiển thị trên góc (VD: `#ABC123`).
2. **Bước 2 (Mở Tab 2 - Khách):**
   - Mở cửa sổ ẩn danh (hoặc tab khác) vào [http://localhost:5173](http://localhost:5173).
   - Ở thanh Navbar, đổi sang tài khoản `john.doe`.
   - Nhập mã phòng vừa copy vào ô *"Nhập mã phòng"* và bấm **Vào phòng**.
3. **Bước 3 (Kiểm tra tương tác thời gian thực):**
   - **Đồng bộ video:** Tại Tab 1 (Host), bấm nút **Play** hoặc tua qua phút thứ `01:00` -> Tab 2 sẽ tự động chạy và nhảy đúng đến phút `01:00`.
   - **Chat thời gian thực:** Nhắn tin từ Tab 2 -> Tab 1 nhận được ngay kèm mốc thời gian video.
   - **Quản lý phòng:** Tại Tab 1, chuyển sang tab *Thành viên*, bấm nút **Tắt chat (Mute)** hoặc **Kick** tài khoản `john.doe` để xem thông báo xử lý tức thì.
