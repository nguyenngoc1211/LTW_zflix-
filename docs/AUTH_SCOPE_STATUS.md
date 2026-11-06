# Trạng thái chức năng Authentication / Security

Rà soát ngày 2026-09-30 trên branch `Du`, commit `55430bf`; working tree sạch trước khi tạo tài liệu này. Phạm vi cá nhân: đăng ký tài khoản local, đăng nhập/đăng xuất, bảo mật tài khoản và phiên, phân quyền cho API admin hiện có. Tài liệu này phản ánh source hiện tại, không coi schema hoặc menu chưa có backend là chức năng đã làm. Chi tiết kỹ thuật và lịch sử phase xem `docs/AUTH_SECURITY_PROGRESS.md`.

## 1. Đã làm và có thể sử dụng

| Nhóm | Chức năng hiện có | Giới hạn cần hiểu |
|---|---|---|
| Đăng ký | Form `/register` và `POST /api/v1/auth/register`; tạo tài khoản local với quyền `user`, mật khẩu bcrypt; kiểm tra dữ liệu, trùng email/username, Origin và rate limit. | Không tự đăng nhập sau đăng ký; chưa xác minh quyền sở hữu email. |
| Đăng nhập | Form `/login`; kiểm tra mật khẩu, chỉ cho tài khoản local đang active; theo dõi số lần sai, khóa tạm; bước xác thực MFA nếu đã bật. | Tài khoản disabled bị từ chối. |
| Phiên đăng nhập | Access JWT ngắn hạn; refresh token trong HttpOnly cookie, chỉ lưu hash ở DB; rotation, hết hạn idle/absolute; khôi phục phiên khi tải lại trang. | Access token chỉ ở bộ nhớ frontend, không lưu browser storage. |
| Đăng xuất | Đăng xuất phiên hiện tại, đăng xuất mọi phiên, đăng xuất các phiên khác; thu hồi một phiên cụ thể. | Các thao tác thu hồi được backend kiểm tra theo tài khoản sở hữu phiên. |
| Bảo mật tài khoản | Trang `/account/security` có đổi mật khẩu, xem và quản lý phiên, bật/tắt MFA TOTP, tạo lại recovery codes. | Đổi mật khẩu và thay đổi trạng thái MFA có thể buộc đăng nhập lại do thu hồi phiên. |
| Quên/reset mật khẩu | Form `/forgot-password`, `/reset-password`; backend tạo token ngẫu nhiên, chỉ lưu hash, có hạn và dùng một lần; reset thành công thu hồi mọi phiên. | Chưa có kênh gửi link ra hộp thư, nên người dùng chưa thể hoàn tất luồng thủ công từ email. |
| Phân quyền admin | `GET /api/v1/admin/check` yêu cầu đăng nhập và role `admin` từ database; frontend kiểm tra quyền trước khi hiện trang admin. | Đây là kiểm tra quyền, **không phải** API quản trị người dùng/nội dung. |
| Gia cố bảo mật | CORS/Origin, cookie an toàn, Helmet, kiểm tra JWT và secret cấu hình, rate limit, structured security log không chứa credential. | CSP riêng cho streaming và hệ thống log tập trung chưa triển khai. |
| Dọn dữ liệu auth | Lệnh thủ công `npm run cleanup:auth` xóa bản ghi auth đã hết hạn/đã dùng theo thời gian lưu giữ, giữ bản ghi còn hiệu lực. | Chưa có lịch chạy tự động khi triển khai. |

Các phase auth/security 1A, 1B, 2, 3, 4A, 4B, 5A, 6 và audit Phase 7 đã hoàn tất theo phạm vi API tại thời điểm tương ứng. Đăng ký và giao diện password lifecycle được bổ sung sau audit, tại commit `55430bf`. Các smoke/integration test đã được ghi trong `docs/AUTH_SECURITY_PROGRESS.md`; tài liệu này không tuyên bố đã kiểm thử production.

## 2. Chưa làm hoặc chưa hoàn chỉnh trong phạm vi auth/security

| Hạng mục | Trạng thái và điều kiện để hoàn chỉnh |
|---|---|
| Gửi email reset mật khẩu | Development/test hiện chỉ giữ link trong bộ nhớ backend; production không có provider gửi mail. Cần chọn kênh SMTP/email, cấu hình secret và địa chỉ gửi, nối vào `password-reset-delivery.js`, kiểm thử gửi thất bại và giám sát delivery. Đây là deferred control, chưa được triển khai. |
| Xác minh email khi đăng ký | Tài khoản local được tạo active ngay; chưa có email verification. Cần một phase auth riêng nếu team yêu cầu. |
| Chống bot nâng cao | Chưa có CAPTCHA hoặc kiểm soát lạm dụng nâng cao; rate limit hiện hữu là theo tiến trình. |
| Xử lý replay refresh theo token family | Refresh rotation đã có; chưa lưu family/history hoặc có phản ứng thu hồi cả family khi phát hiện replay. |
| CSP, log và vận hành production | Helmet có nhưng CSP đang tắt để chờ chính sách tương thích streaming; chưa có SIEM/alerting, archive log bất biến hoặc scheduler cleanup. |
| Đồng bộ nhiều tab và phương thức đăng nhập khác | Chưa đồng bộ trạng thái auth giữa các tab; OAuth, passkeys/WebAuthn, trusted devices và recovery nâng cao vẫn deferred. |

Các mục trên **không tự động trở thành việc phải làm ngay**: cần scope, hạ tầng và ưu tiên riêng. Đặc biệt không được gọi luồng quên mật khẩu là “gửi email thành công” khi chưa có provider.

## 3. Cần chờ phase/API của team khác

Backend hiện chỉ cung cấp các API auth, một API admin check và health; hai Python service chỉ expose health. Các mục sau chưa có API nghiệp vụ thật, nên phần phân quyền/IDOR tương ứng chưa thể hoàn tất:

| Nhóm phụ thuộc team | Hiện trạng | Việc auth/security phải làm khi API xuất hiện |
|---|---|---|
| Trang admin Analytics, Users, Content, Community | Route/menu frontend có, nhưng trang con chỉ hiển thị `Test`; không có backend admin CRUD hay moderation. | Team triển khai nghiệp vụ trước; sau đó kiểm tra `requireAuth`, role admin, policy từng thao tác và regression 401/403. |
| Profile update/delete | Chưa có API. | Ràng buộc current user, chống sửa tài khoản khác và mass assignment. |
| Favorites/bookmarks, watch history, comments/likes, ratings/reviews | Có thể có khái niệm trong schema, nhưng chưa có API backend. | Kiểm tra ownership, IDOR/BOLA và quyền tạo/sửa/xóa theo từng resource thật. |
| Watching party, participant, chat, host management | Chưa có API backend. | Xác định quyền host/thành viên và kiểm tra ownership theo API thật. |
| Premium, subscriptions, transactions | Chưa có API backend thực thi entitlement. | Enforce premium ở server, không tin trạng thái từ frontend hoặc request client. |

Không dựng API hoặc giao diện quản trị giả chỉ để hoàn thiện danh sách. Khi team giao route nghiệp vụ thật, cần rà soát lại authorization cho từng route; kết quả audit Phase 7 không chứng nhận an toàn cho các API chưa tồn tại.

## Mốc bàn giao scope cá nhân

Phần đăng nhập/đăng xuất và bảo mật cho **các API đang có** đã có backend, UI và kiểm thử hồi quy. Các phần còn thiếu được tách rõ thành auth hardening deferred và phụ thuộc phase nghiệp vụ của team. Admin trong scope hiện tại là **kiểm tra và bảo vệ quyền truy cập**, không phải xây hệ thống quản trị nội dung/người dùng.
