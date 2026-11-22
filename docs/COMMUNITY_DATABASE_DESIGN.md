# Dữ liệu Community trên MongoDB

Cập nhật theo `main` tại `63cdba4` ngày 22/11/2026; code tương ứng `0bc2732` vì commit mới chỉ sửa README. File này mô tả các collection Community và cách code dùng chúng; nó không chứng minh validator/index đã được áp dụng trên mọi database đang chạy.

## Collection chính

| Collection | Dùng cho |
|---|---|
| `community_posts` | Bài diễn đàn và câu hỏi cảnh phim, phân loại bằng `content_type`. |
| `community_post_comments` | Bình luận/reply trên post; liên kết post qua ID số. |
| `community_post_votes`, `community_poll_votes`, `community_comment_votes` | Vote bài, poll và bình luận. |
| `community_saved_posts`, `community_follows` | Bài đã lưu và quan hệ follow. |
| `community_reports` | Báo cáo bài, comment, rating hoặc tài khoản. |
| `point_transactions`, `point_daily_quotas`, `monthly_leaderboards`, `monthly_vip_rewards` | Sổ điểm, quota, snapshot tháng và phần thưởng chờ duyệt. |
| `quest_claims`, `quest_definitions`, `achievement_definitions` | Tiến độ/nhận thưởng nhiệm vụ và định nghĩa huy hiệu. |
| `moderation_audit`, `point_admin_audit`, `point_review_flags` | Nhật ký hành động kiểm duyệt, chỉnh điểm và cờ cần xem xét. |

Movie comments và ratings tiếp tục dùng các collection `comments` và `ratings` riêng. Notifications được lưu trong `notifications`; bài và comment có thể tham chiếu `users`, `productions` và `episodes` bằng ID số.

## Bất biến được kiểm ở service

- Identity lấy từ `req.user.id`; không tin user/author ID do client gửi để chọn actor.
- Bài có `status`/`visibility`; API kiểm tra quyền xem trước khi trả hoặc cho phép tương tác.
- Sửa/xóa chỉ cho tác giả hoặc vai trò staff được route cho phép. Points và bộ đếm liên quan được cập nhật trong transaction ở các luồng hỗ trợ.
- Vote dùng khóa duy nhất theo user và đối tượng. Báo cáo chặn tự báo cáo, giới hạn tần suất và không cho xử lý cùng report nhiều lần.
- Ảnh comment/bài dùng storage URL công khai. Vì vậy ảnh không được đính vào nội dung chỉ dành cho members; private media cần thiết kế storage khác.

## Validator và index

`backend-node/src/modules/community/community.schema.js` khai báo validator/index cho một nhóm collection. `backend-node/scripts/init-community-schema.js` có guard test-only, từ chối URI/database ứng dụng và collection đã tồn tại. Script này không phải migration production, không cập nhật collection cũ và không tự chạy khi server khởi động.

Các module còn có `ensure*Indexes()` cho một số collection vận hành, ví dụ points, quests, notification và follow. Việc một index được khai báo trong source không chứng minh nó đã được tạo trên database đang chạy. Trước khi áp dụng thay đổi schema production, cần preflight dữ liệu/index, kiểm thử database test riêng và có kế hoạch rollback.

## Kiểm thử

Integration scripts nằm trong `backend-node/integration/`. Chúng có thể ghi dữ liệu; đọc phần guard của từng script và xác nhận URI/database test trước khi chạy. Không dùng `Zflix` hoặc database người dùng làm fixture.
