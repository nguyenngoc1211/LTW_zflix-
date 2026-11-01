# Movie Community: thiết kế dữ liệu giai đoạn 2

Các định nghĩa MongoDB nằm tại `backend-node/src/modules/community/community.schema.js` và dùng driver MongoDB hiện có. Không dùng Mongoose. Các collection mới có tiền tố `community_`; ID tham chiếu user, production và episode là ID số hiện có. `_id` của bản ghi community do service giai đoạn sau cấp; service phải dùng ID số tương thích các trường tham chiếu. Không tự động tạo collection khi khởi động ứng dụng.

## Phạm vi và dữ liệu cũ

- `community_posts` là nguồn duy nhất cho bài thường và screenshot. Trang phim và feed truy vấn cùng bản ghi; không tạo comment phim giả. Có index feed, production/tập, nhóm và tác giả.
- `community_post_comments`, `community_post_votes`, `community_comment_votes`: bình luận bài và vote; unique index bảo đảm một user một vote trên mỗi đối tượng. Bình luận phim `comments` không bị thay đổi.
- `community_groups`, `community_members`, `community_follows`, `community_saved_posts`, `community_reports`, `community_watch_diary` phục vụ các giai đoạn sau. Nhật ký xem tách khỏi `watch_history`; quyền riêng tư phải được kiểm tra khi đọc.
- Tái sử dụng `ratings` cho review và `notifications` cho thông báo. Chưa sửa validator hay index các collection cũ, tránh ảnh hưởng dữ liệu và API hiện hữu. Cần khảo sát index, dữ liệu trùng và kế hoạch tương thích trước khi mở rộng chúng. `bookmarks` hiện là phim yêu thích, không phải bài đã lưu.

## Bất biến cần service bảo đảm

Validator là lớp kiểm tra hình dạng cơ bản, không thay thế validation nghiệp vụ. Service phải kiểm tra sự tồn tại và quyền truy cập user/production/episode/group; episode thuộc đúng production theo quy ước series/mùa thực tế; ảnh screenshot, timestamp và production bắt buộc cho post screenshot; timestamp hữu hạn và nằm trong thời lượng hợp lệ; khóa ảnh thuộc upload được phép; visibility và membership; giới hạn độ sâu; không tự follow. Trường tùy chọn được bỏ qua thay vì ghi null. Các collection mới dùng status để hỗ trợ soft delete khi cần.

Vote và thay đổi bộ đếm phải thực hiện nguyên tử bằng transaction MongoDB trên triển khai hỗ trợ transaction; cần xử lý retry/xung đột và có đối soát bộ đếm. Chỉ số unique không tự cập nhật bộ đếm. Trước khi mở rộng ratings cần kiểm tra unique `(user_id, production_id)` trên MongoDB và dữ liệu hiện hữu. Không thay đổi thang điểm hoặc API rating cũ trong giai đoạn này.

## Áp dụng và giới hạn

Script `backend-node/scripts/init-community-schema.js` chỉ cho phép database thử nghiệm riêng có tên `community_test_<suffix>`, qua `COMMUNITY_TEST_MONGODB_URI` và `COMMUNITY_TEST_DB_NAME`; từ chối database ứng dụng và collection đã tồn tại. Script không xóa dữ liệu; nếu lỗi giữa chừng có thể tạo một phần collection, cần kiểm tra và xử lý riêng trên database thử nghiệm. Chưa có migration production; cần xây dựng quy trình preflight, xử lý index/validator và rollback có kiểm soát trước khi áp dụng thật. MySQL chưa có schema cho community mới.

Ảnh upload có bản ghi `community_upload_cleanup` trước khi ghi R2. `node scripts/reconcile-community-uploads.js` chỉ báo cáo tối đa 500 bản ghi quá 24 giờ và kiểm tra cả bài đã xóa mềm. `--apply` yêu cầu dừng toàn bộ tiến trình có thể upload trước, sau đó đặt `COMMUNITY_UPLOAD_WRITERS_STOPPED=yes`; tác vụ giữ ảnh được tham chiếu và thử xóa đúng key không tham chiếu. Nếu không dừng writers, việc kiểm tra rồi xóa có thể đua với một request đang tạo bài. Chưa tự động lập lịch; không chạy trên production khi chưa có quy trình vận hành và kiểm thử storage riêng.
