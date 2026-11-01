# Theo dõi Movie Community

Cập nhật: 01/11/2026. Trạng thái dưới đây phân biệt mã đã viết với chức năng đã kiểm thử trên môi trường thực tế.

## Kiến trúc hiện tại

- Frontend: React, Vite, React Router, Tailwind và Ant Design. Backend: Express, MongoDB driver trực tiếp và nhánh MySQL/Prisma.
- Player dùng HTML5 video và HLS.js. Bình luận phim, rating, auth, production và episode hiện có được tái sử dụng.
- Một screenshot post trong `community_posts` được truy vấn ở feed và dưới phim, không tạo bản sao bài viết.

## Tiến độ

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| 1. Phân tích | Đã khảo sát source | Xác định kiến trúc, phần có sẵn và các rủi ro tích hợp. |
| 2. Database | Đã kiểm thử trên database test | Có validator screenshot và index theo phim. Chưa áp dụng vào database ứng dụng. |
| 3. Bài viết | Triển khai một phần | API Posts, upload, lưu, chia sẻ và form sửa đã có; API đã smoke test trên database test, còn thiếu kiểm thử giao diện. |
| 4. Giao diện | Triển khai một phần | Feed, tạo, chi tiết, saved; form tạo nhận ID phim/tập/nhóm và tags. Chưa có bộ chọn, các trang nhóm và profile đầy đủ. |
| 5. Bình luận và vote | Đang triển khai | Đã có bình luận phân cấp, vote bài và vote bình luận; smoke test cơ bản đạt, cần kiểm thử đồng thời. |
| 6–7. Screenshot và hiển thị | Đang triển khai | Dưới phim dùng một mục Bình luận chung cho bình luận và screenshot; API test xác nhận đồng bộ qua hai truy vấn. Chưa kiểm thử end-to-end trên hai giao diện hoặc R2 thật. |
| 8–12. Review, cộng đồng, social, thông báo, kiểm duyệt | Chưa hoàn tất | Có rating và thông báo cơ bản; cần mở rộng theo yêu cầu và kiểm thử quyền. |

## Thay đổi giai đoạn 5

- `PUT /api/v1/community/posts/:id/comments/:commentId/vote` nhận `value` là `-1`, `0` hoặc `1`; yêu cầu đăng nhập, kiểm tra quyền đọc post và trạng thái comment.
- Vote và điểm comment được cập nhật trong transaction; vote mới dùng `_id` xác định theo comment và user. Định nghĩa unique index `(comment_id, user_id)` đã có nhưng chưa xác minh được áp dụng trong DB ứng dụng.
- Giao diện bình luận có nút ủng hộ, không ủng hộ, bỏ vote và hiển thị điểm. Đã bổ sung các tình huống tương ứng vào integration smoke test.

## Kiểm thử và giới hạn

- Đã gộp ba tab dưới player thành một mục Bình luận, giữ form gửi và bộ lọc khoảnh khắc theo tập. ESLint, build và test thứ tự feed đạt; chưa kiểm thử trực quan hoặc gửi bình luận thật qua trình duyệt sau thay đổi.
- Bản thử local trước đó dùng database `community_test_schema_20261101`, có post #26 và ba bình luận mẫu; các bản ghi đó vẫn ở database test, không sao chép sang database chính.
- Theo yêu cầu dùng dữ liệu thật, bản local tại `http://127.0.0.1:5174/community` đã chuyển sang backend `127.0.0.1:3002` dùng database `Zflix`; frontend và API trả thành công. Đã tạo các collection Community còn thiếu và index cần thiết, không xóa dữ liệu hoặc thay validator collection đã tồn tại. Đây là chạy local, chưa kiểm tra trực quan trình duyệt hay triển khai production.
- Sau đó đã khởi động lại backend ứng dụng chính trên cổng 3000 với mã hiện tại, dùng MongoDB `Zflix`; frontend chính ở `http://localhost:5173/community`. API diễn đàn trả trường tác giả/trạng thái lưu mới, API kho phim trả dữ liệu; bản preview cổng 5174/3002 đã dừng. Chưa kiểm thử giao diện qua trình duyệt hoặc thao tác ghi bằng tài khoản thật.
- Bài viết hiện hiển thị username/avatar công khai và trạng thái đã lưu theo người xem; có thể bỏ lưu trong trang Bài đã lưu. API lấy thông tin theo lô, không trả email hoặc mật khẩu. Smoke test MongoDB kiểm tra lưu/bỏ lưu, phân biệt người dùng và trường dữ liệu công khai; ESLint và frontend build đạt. Chưa kiểm thử giao diện trên trình duyệt.
- Tab Tất cả dùng phân trang tùy chọn mới của API bình luận phim, lấy dần bình luận và screenshot để gộp đúng thứ tự; các client không gửi tham số vẫn nhận phản hồi cũ. Test MongoDB kiểm tra thứ tự khi trùng thời gian, phân trang và giới hạn; unit test, ESLint và frontend build đạt. Cần tối ưu cursor cho trang sâu.
- Screenshot API smoke test xác nhận cùng post ID hiển thị trên feed và truy vấn phim/tập, cập nhật thống nhất vote, bình luận, tiêu đề, spoiler và xóa mềm. Ảnh và storage được giả lập; chưa kiểm thử trực quan hoặc R2 thật.
- Giao diện rating đã thêm điểm trung bình, phân bố 1–5 sao và xóa đánh giá của chính người dùng; ESLint và build đạt. Chưa có kiểm thử giao diện thực tế; spoiler review và profile review chưa hoàn tất.
- MongoDB test: thêm tình huống hai người vote bình luận đồng thời; smoke test đạt, dữ liệu fixture được dọn theo post thử nghiệm. Không ghi database `zflix`.
- Ngày 01/11/2026: kết nối xác nhận database `community_test_schema_20261101`. Cập nhật validator và index của hai collection test rỗng `community_posts`, `community_post_comments`; không reset collection và không thay đổi database `zflix`.
- Trên database test, schema smoke đạt (validator, index, từ chối vote trùng); Posts smoke đạt, bao gồm tạo/sửa/xóa, phân quyền, comment, vote bài và comment, ảnh screenshot giả lập R2, rating/review; upload smoke đạt với lỗi storage giả lập. Các fixture được dọn; bộ đếm ID và metadata schema test có thể vẫn thay đổi.
- Review smoke kiểm tra đăng nhập, điểm không hợp lệ, tạo và sửa review duy nhất, đọc và xóa; chưa bao phủ mọi tình huống review hoặc kiểm thử đồng thời. Chưa kiểm thử upload lên R2 thật hoặc toàn bộ giao diện trên trình duyệt.
- Giai đoạn 5: `node --check` route đạt, ESLint `PostComments.jsx` đạt, frontend build đạt và 4/4 unit test schema/ảnh đạt. Build còn cảnh báo bundle lớn.
- Lần chạy trước khi cấu hình MongoDB đã dừng ở bước bảo vệ; các smoke test sau khi cấu hình có kết quả như trên.
- Lượt tiếp theo: ESLint các file screenshot/player/Community đạt, frontend build đạt và 7/7 unit test schema/ảnh/watch URL đạt. Chưa chạy được kiểm thử đăng nhập, upload và đồng bộ trên MongoDB test.
- Các lượt trước: 7/7 unit test schema, ảnh và watch URL đạt; frontend build đạt. ESLint toàn frontend có hai lỗi và ba cảnh báo tại module khác.
- MongoDB integration yêu cầu `COMMUNITY_TEST_MONGODB_URI` và chính xác `COMMUNITY_TEST_DB_NAME=community_test_schema_20261101`, có hỗ trợ transaction; không dùng database ứng dụng thay thế.
- Screenshot upload đã được smoke test bằng storage giả lập; chưa có bằng chứng kiểm thử R2 thật, đồng bộ tương tác trên hai giao diện hoặc responsive.
- Database `Zflix` đã được tạo index Community và validator cho các collection mới còn thiếu sau khi kiểm tra trùng vote; validator các collection đã tồn tại chưa được cập nhật. Không xóa dữ liệu hoặc thêm bài mẫu vào database chính.

## Công việc tiếp theo

1. Mở rộng kiểm thử vote đồng thời, bài riêng tư và comment đã xóa trên database test.
2. Kiểm thử screenshot và luồng một post xuất hiện trên hai giao diện; tối ưu cursor cho trang sâu.
3. Tiếp tục review, groups, social, notifications và moderation sau khi các phụ thuộc được xác nhận.
