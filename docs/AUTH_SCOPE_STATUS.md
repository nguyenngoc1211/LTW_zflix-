# Trạng thái Authentication và Authorization

Cập nhật theo `main` tại `63cdba4` ngày 22/11/2026; code tương ứng `0bc2732` vì commit mới chỉ sửa README. Đây là tóm tắt hiện trạng, không phải chứng nhận an toàn production. Lịch sử phase và bằng chứng test theo ngày nằm trong [`AUTH_SECURITY_PROGRESS.md`](AUTH_SECURITY_PROGRESS.md).

## Auth hiện có

- `POST /api/v1/auth/register` tạo tài khoản local role `user`; login, logout, refresh và `/me` dùng access JWT cùng session trong database.
- Refresh token nằm trong cookie HttpOnly; access token được giữ trong memory ở frontend. Role và trạng thái tài khoản được backend đọc từ database, không lấy từ JWT role hoặc trạng thái giao diện.
- Có MFA/TOTP và recovery code, đổi/đặt lại mật khẩu, danh sách session, thu hồi phiên và rate limit cho các route auth chính.
- MongoDB là data store trong Docker Compose. Nhánh MySQL tương thích vẫn tồn tại trong source; kiểm tra đúng `DATA_STORE` và module đang dùng trước khi kiểm thử.

## Authorization nghiệp vụ hiện có

Backend hiện có API cho community posts/comments/votes/reports, profile/follow, notifications, points, quests, moderation, admin, Watch Party, streaming, shopping, Lensy và đơn VIP. Từng router áp dụng policy riêng: public/optional-auth, người dùng đã đăng nhập, chủ sở hữu, staff (`admin`/`moderator`) hoặc admin-only. Không suy quyền chỉ từ menu hay `ProtectedRoute`; xem source của route trước khi thay đổi policy.

Một số module mới, gồm points, quests và một phần moderation, chỉ chạy với MongoDB và trả lỗi nếu `DATA_STORE` khác `mongodb`. Mã SQL/MySQL vẫn còn trong các module cũ, nên migration toàn bộ chưa hoàn tất.

## Giới hạn cần nhớ

| Hạng mục | Trạng thái |
|---|---|
| Gửi email reset mật khẩu | Cần provider email; giao diện không đồng nghĩa email đã được gửi. |
| Email verification, OAuth, passkeys | Chưa có trong auth hiện tại. |
| Cleanup auth | Có lệnh `npm run cleanup:auth`; chưa có scheduler triển khai chung được xác nhận. |
| Rate limit | Theo tiến trình backend; đánh giá lại khi chạy nhiều instance/proxy. |
| CSP và logging production | CSP của Helmet đang tắt; chưa có SIEM/alerting hoặc audit pipeline bất biến. |
| Production readiness | Chưa xác nhận bằng tài liệu này. Cần test cấu hình, replica-set/transaction, proxy, storage và email ở môi trường đích. |

Khi thêm route ghi dữ liệu: lấy actor từ `req.user.id`, validate allow-list, kiểm tra owner/role ở backend, và thêm regression test cho guest, owner, user khác và admin theo policy của resource.
