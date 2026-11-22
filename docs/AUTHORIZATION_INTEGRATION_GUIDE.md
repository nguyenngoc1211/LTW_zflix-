# Hướng dẫn tích hợp Authorization

Hướng dẫn này áp dụng cho backend trên `main` tại `63cdba4`, code tương ứng `0bc2732`; commit mới chỉ sửa README. Khác với bản đầu viết khi phần lớn business API chưa có, source hiện đã có community, Watch Party, VIP, points, quests, moderation và các API admin. Trước khi thêm route hoặc đổi quyền, đọc handler/module tương ứng; chính sách giữa các module không hoàn toàn giống nhau.

## Ranh giới xác thực

- `requireAuth` xác minh access JWT, session và user từ database rồi gắn `req.user`/`req.auth`.
- `requireRole(...)` kiểm tra role đã nạp từ database. Một số module dùng middleware `admin`, `staff` hoặc kiểm tra owner ngay trong router/service.
- Account `disabled` bị chặn; MongoDB path kiểm tra thêm `moderation_locked_until` trong login, refresh và request auth.
- `ProtectedRoute` và trạng thái frontend chỉ điều khiển UX. API phải tự enforce quyền.

Authentication đang có đường MongoDB và đường MySQL tương thích. Compose chọn MongoDB. Trước khi thêm API, xác nhận module đang đọc DB nào và không gọi trực tiếp pool khi cấu hình `DATA_STORE=mongodb` nếu module chưa hỗ trợ.

## Chọn policy cho route mới

| Loại endpoint | Cách làm |
|---|---|
| Dữ liệu public | Không thêm auth nếu nội dung thực sự public; lọc status/visibility ở backend. |
| Thao tác của user hiện tại | Dùng `requireAuth`; lấy ID actor từ `req.user.id`, không lấy từ body/query. |
| Tài nguyên có owner | Đọc owner từ document database; so sánh với `req.user.id`. Chọn nhất quán `403` hoặc `404` theo policy module. |
| Staff/admin | Dùng `requireAuth` rồi kiểm tra role trong database; phân biệt `admin` với `admin`/`moderator` theo thao tác. |
| Ghi có cookie/session | Áp dụng Origin guard theo các route hiện hữu, rate limit nếu có nguy cơ lạm dụng và chỉ nhận field trong allow-list. |

Ví dụ minh họa. Tên resource và middleware phụ có thể cần đổi theo module thật:

Với một thao tác có owner, parse ID, tải tài nguyên từ database, so sánh owner đã lưu với `req.user.id`, rồi ràng buộc điều kiện owner/status ngay trong mutation. Nếu nghiệp vụ cho admin override, kiểm tra role đã nạp từ DB và ghi audit theo chính sách module. Không có generic ownership middleware dùng chung cho mọi resource.

Không truyền `req.body` nguyên khối vào `$set`/SQL update. Không cho client đặt `role`, `status`, `vip_expires_at`, `author_id`, `owner_id` hoặc các trường session. Khi xóa/ẩn nội dung liên quan points, reports, notifications hoặc ảnh, dùng transaction và dịch vụ hiện có để cập nhật đủ dữ liệu phụ thuộc.

## Quyền hiện tại cần lưu ý

- Admin root gồm các route dưới `/api/v1/admin`; từng router xác định staff hay admin-only.
- `/api/v1/admin/points`, `/api/v1/admin/quests` và `/api/v1/admin/moderation` là admin-only trong router hiện tại.
- Xét duyệt đơn VIP cho phép staff; sửa gói VIP chỉ admin.
- Owner có thể sửa/xóa nội dung của mình; admin/moderator có một số quyền xóa/kiểm duyệt theo loại nội dung. Kiểm tra đúng handler trước khi mở rộng.
- API points/quests/moderation mới có phần phụ thuộc MongoDB; chúng không phải API SQL dùng chung.

## Regression cần có

Với mỗi endpoint protected, test guest `401`, user được phép, user khác, role không đủ và admin theo policy cụ thể. Thử sửa `userId`/owner ID trong body/query, trường đặc quyền ngoài allow-list, request lặp và trạng thái account disabled/đang moderation lock. Kiểm tra dữ liệu của user khác không bị trả về hoặc thay đổi.

Ưu tiên database test riêng có transaction support. Không chạy smoke test ghi dữ liệu vào `Zflix` hoặc database dùng thật. Các integration script có thể có guard theo tên database; đọc đầu file trước khi chạy.
