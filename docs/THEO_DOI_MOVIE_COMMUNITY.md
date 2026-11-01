# Theo dõi Movie Community

Cập nhật: 02/11/2026. Trạng thái dưới đây phân biệt mã đã viết với chức năng đã kiểm thử trên môi trường thực tế.

## Kiến trúc hiện tại

- Frontend: React, Vite, React Router, Tailwind và Ant Design. Backend: Express, MongoDB driver trực tiếp và nhánh MySQL/Prisma.
- Player dùng HTML5 video và HLS.js. Bình luận phim, rating, auth, production và episode hiện có được tái sử dụng.
- `community_posts` chứa hai loại nội dung: `community_post` cho diễn đàn và `scene_question` cho hỏi đáp cảnh phim. Bài mới do server gán loại; hai loại không xuất hiện chéo. Bản ghi cũ thiếu `content_type` tạm thời thuộc Community, không sao chép hoặc tự động phân loại lại.

## Tiến độ

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| 1. Phân tích | Đã khảo sát source | Xác định kiến trúc, phần có sẵn và các rủi ro tích hợp. |
| 2. Database | Đã kiểm thử trên database test | Có validator screenshot và index theo phim. Chưa áp dụng vào database ứng dụng. |
| 3. Bài viết | Triển khai một phần | API Posts, upload, lưu, chia sẻ và form sửa đã có; API đã smoke test trên database test, còn thiếu kiểm thử giao diện. |
| 4. Giao diện | Triển khai một phần | Feed, tạo, chi tiết, saved; form tạo nhận ID phim/tập/nhóm và tags. Chưa có bộ chọn, các trang nhóm và profile đầy đủ. |
| 5. Bình luận và vote | Đang triển khai | Đã có bình luận phân cấp, vote bài và vote bình luận; smoke test cơ bản đạt, cần kiểm thử đồng thời. |
| 6–7. Screenshot và hiển thị | Đã tách trong source, cần kiểm thử thực tế | Form hỏi về cảnh phim dùng API riêng; câu hỏi và bình luận phim có khu vực riêng. Chưa kiểm thử chụp video và upload R2 thật. |
| 8–12. Review, cộng đồng, social, thông báo, kiểm duyệt | Chưa hoàn tất | Có rating và thông báo cơ bản; cần mở rộng theo yêu cầu và kiểm thử quyền. |

## Thay đổi giai đoạn 5

Các mục dưới đây ghi lại lịch sử theo từng thời điểm. Thiết kế một screenshot xuất hiện ở cả hai nơi đã được thay thế bằng mục **Tách hỏi đáp khoảnh khắc khỏi cộng đồng** ở cuối tài liệu.

- `PUT /api/v1/community/posts/:id/comments/:commentId/vote` nhận `value` là `-1`, `0` hoặc `1`; yêu cầu đăng nhập, kiểm tra quyền đọc post và trạng thái comment.
- Vote và điểm comment được cập nhật trong transaction; vote mới dùng `_id` xác định theo comment và user. Định nghĩa unique index `(comment_id, user_id)` đã có nhưng chưa xác minh được áp dụng trong DB ứng dụng.
- Giao diện bình luận có nút ủng hộ, không ủng hộ, bỏ vote và hiển thị điểm. Đã bổ sung các tình huống tương ứng vào integration smoke test.

## Kiểm thử và giới hạn

- Bình luận phim đã có trả lời tối đa ba cấp, tải trang replies, vote, spoiler, sửa/xóa của tác giả và báo cáo cơ bản; integration test MongoDB test và UI test giả lập đã chạy. Báo cáo hiện là form inline, chưa có modal/luồng moderator, chưa hỗ trợ ảnh đính kèm và chưa hoàn tất các tính năng tương đương cho comment của screenshot post.
- Đã chạy lại 69/69 backend unit test, ESLint các file liên quan, frontend build và UI smoke giả lập; backend chính được khởi động lại, GET bình luận trả 200 và vote không xác thực trả 401. Không chạy test ghi trên `Zflix`. Screenshot post có thể hiện và ẩn lại nội dung spoiler; chưa kiểm thử lưu R2 thật cho ảnh bình luận.
- Nâng cấp bình luận nhóm A: điều chỉnh giao diện bình luận phim với avatar 40 px, tên, thời gian và nội dung; thu gọn nút thao tác hiện có của screenshot post dưới phim. Kiểm thử trình duyệt với API giả lập xác nhận avatar dự phòng, vote/mở bình luận hiện có và bố cục mobile; ESLint và frontend build đạt. Bình luận phim chưa được thêm nút vote/reply giả.
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
2. Kiểm thử screenshot thật và bảo đảm câu hỏi không xuất hiện trong feed Community; tối ưu cursor cho trang sâu.
3. Tiếp tục review, groups, social, notifications và moderation sau khi các phụ thuộc được xác nhận.
### Thống nhất giao diện bình luận (2026-11-01)

- Bình luận phim và bình luận bài viết dùng chung khung, thanh thao tác, biểu mẫu trả lời và phần ẩn/hiện spoiler; mỗi loại vẫn gọi API riêng. API đọc bài viết và bình luận bài viết trả thêm lựa chọn vote của người đang đăng nhập để giao diện khôi phục trạng thái.
- Báo cáo bình luận bài viết, đính kèm ảnh và kiểm duyệt vẫn chưa được triển khai; không hiển thị nút giả. Kiểm thử giao diện dùng API giả lập, không thay thế kiểm thử thực tế với player và tài khoản.

### Bố cục thảo luận trang xem (2026-11-01)

- Đưa thảo luận xuống ngay dưới cột player thay vì dưới hàng grid bị kéo cao bởi danh sách tập hoặc thông tin phim. Khoảnh khắc trên trang xem mặc định lấy toàn bộ tập; bỏ lựa chọn spoiler khỏi form bình luận, giữ việc che spoiler cũ. Sau đó cũng đã bỏ checkbox spoiler khỏi form trong diễn đàn.
- Các luồng phân trang bình luận dùng chung thanh điều hướng nhỏ; API hiện tại không trả tổng số trang nên chỉ hiển thị trang hiện tại.

### Cuộn ba cột trang xem (2026-11-01)

- Bỏ sticky, chiều cao theo viewport và cuộn riêng của danh sách tập; bỏ chiều cao 100% và overflow riêng của thông tin phim. Ba cột căn đầu hàng, nội dung cuộn theo trang; bình luận vẫn nằm ngay dưới player.
- Test trình duyệt với dữ liệu giả lập gồm 35 tập đo vị trí sidebar tại đầu trang, giữa trang và khu vực thảo luận; kiểm tra kích thước cột không đổi và mobile không tràn ngang. Chưa kiểm thử phát video hoặc chụp ảnh thật.

### Tách hỏi đáp khoảnh khắc khỏi cộng đồng (2026-11-01)

- Bài mới dùng `content_type` do server gán. Bài thiếu trường tạm thời chỉ thuộc Community; câu hỏi mới qua `/api/v1/scene-questions` và không được trả trong feed Community. Hai loại tiếp tục dùng cùng collection và các collection vote/reply hiện có.
- Báo cáo chỉ đọc trên database cấu hình `Zflix`: hai screenshot cũ thiếu phân loại, không gắn cộng đồng, không thiếu các trường metadata được kiểm tra. Không thể xác định ý định tác giả chỉ từ metadata; chưa migration.
- Có API báo cáo câu hỏi/câu trả lời, giới hạn tần suất; test integration dùng database test và upload R2 giả lập. Chưa kiểm tra chụp video và upload R2 thực tế; index mới chỉ được khai báo trong source, chưa áp dụng lên database chính.

#### Chi tiết triển khai và bàn giao

- Luồng người dùng: nút **Hỏi về cảnh này** chụp khung hình, hiển thị preview và form câu hỏi; gửi ảnh, phim, tập và thời điểm tới `POST /api/v1/scene-questions/with-images`. Backend tự gán `scene_question`; không còn chọn nhóm trong form. Canvas vẫn tuân theo giới hạn CORS và bảo vệ của nguồn video.
- Feed và bài lưu dùng `/api/v1/community/posts`, lọc `community_post` cùng các bản ghi cũ chưa phân loại. API `/api/v1/scene-questions?movieId=...` chỉ trả câu hỏi của phim, mặc định gồm mọi tập. Các thao tác theo ID kiểm tra loại trước khi tiếp tục kiểm tra quyền hiện có.
- Vote câu hỏi dùng `community_post_votes`; câu trả lời phân cấp dùng `community_post_comments` và `community_comment_votes`. Các bản ghi giữ nguyên ID, tác giả và liên kết; có thể sửa/xóa theo quyền, báo cáo câu hỏi hoặc câu trả lời. Báo cáo yêu cầu đăng nhập, kiểm tra nội dung có thể xem, giới hạn tần suất và chống gửi trùng.
- Link timestamp vẫn đi qua `/watch-episode/:episodeId?pos=...` để tra đúng phim/tập và chuyển tới trang xem chuẩn. Các bài screenshot cũ thiếu `content_type` vẫn truy cập qua link Community cũ; chúng không tự động trở thành câu hỏi.
- Frontend: `ScreenshotComposer.jsx`, `MovieDiscussion.jsx`, `AllDiscussion.jsx`, `CommunityPage.jsx`, `PostComments.jsx` và `UnifiedComment.jsx`. Backend: `app.js`, `community.schema.js` và `posts.routes.js`. Lịch sử kiểm thử nằm tại `backend-node/integration/community-posts-smoke.js` và `frontend/integration/movie-discussion-ui-smoke.js`.
- Kiểm thử lượt tách: backend unit 69/69; integration smoke đạt trên `community_test_schema_20261101`, bao gồm phân tách feed, vote, trả lời, báo cáo và tương thích bản ghi thiếu loại; ESLint các file frontend liên quan và build đạt. Test trình duyệt dùng API/frame giả lập; build có cảnh báo bundle lớn. Không chạy test ghi dữ liệu trên `Zflix`.
- Kiểm kê chỉ đọc bằng `backend-node/integration/scene-legacy-report.js`: database cấu hình thực tế `Zflix` có 2 screenshot cũ thiếu `content_type`, cả hai không gắn cộng đồng và không thiếu các trường metadata được kiểm tra. Chưa xác định ý định tác giả; không sửa hoặc xóa chúng. Kiểm kê không khẳng định nội dung dữ liệu là hợp lệ toàn diện.
- Quy trình nếu migration được yêu cầu sau này: thống nhất phân loại từng trường hợp mơ hồ, lập dry-run và kiểm thử trên database test; chỉ cập nhật trường phân loại trên bản ghi gốc sau khi được duyệt riêng, giữ ảnh, `_id`, vote và comment. Chưa có migration được chạy trên database chính.
- Việc còn lại: thử phát video, chụp screenshot, upload R2, seek timestamp và các thao tác bằng tài khoản thật; kiểm tra xử lý báo cáo ở giao diện quản trị. Index mới mới chỉ khai báo trong source, chưa được áp dụng trên database chính. Các thay đổi trong workspace chưa được commit.
- Form tạo và sửa hỏi đáp đã rút gọn còn một ô câu hỏi, bỏ checkbox spoiler trong luồng hỏi đáp. Để tương thích schema/API, câu hỏi được gửi trong trường `title`, `content` của câu hỏi mới rỗng và `isSpoiler` là false; dữ liệu cũ và trạng thái spoiler cũ vẫn được giữ. Test trình duyệt giả lập, ESLint file liên quan và frontend build đạt; chưa thử upload R2 thật.
- Đã khởi động lại backend để nạp route hỏi đáp; GET `/api/v1/scene-questions?movieId=54` trả HTTP 200. Đã bỏ checkbox spoiler khỏi tạo/sửa bài và bình luận Community; bài và bình luận cũ vẫn giữ trạng thái spoiler đã lưu. Kiểm tra trình duyệt với API giả lập, ESLint file liên quan và build đạt; chưa kiểm thử gửi câu hỏi thật hoặc upload R2 thật.
- Ngày 02/11/2026: API bình luận bài viết/hỏi đáp trả `reply_count` cho từng bình luận, kể cả bình luận con; giao diện cập nhật số sau khi gửi và hiển thị `Trả lời (N)`. Số đếm gồm các câu trả lời trực tiếp đang hiển thị, kể cả placeholder đã xóa để không mất nhánh con. Integration test ba cấp đạt trên database test riêng; UI giả lập, ESLint và build đạt. Backend local đã khởi động lại; chưa test thao tác bằng tài khoản thật.
- Upvote và downvote được hiển thị thành hai số riêng cạnh từng nút cho bài viết, câu hỏi và bình luận. API trả hai số từ các bản ghi vote; `score` tiếp tục được duy trì để sắp xếp và tương thích. Nút vote tạm khóa trong lúc yêu cầu đang xử lý; trạng thái được tải lại khi đổi người dùng. Integration test trên database test, UI giả lập, ESLint và build đạt; backend local đã nạp API mới. Không chạy test ghi trên `Zflix`.

#### Kiểm thử vote riêng (02/11/2026)

- Với mỗi người dùng, bấm lại cùng nút để bỏ vote; bấm nút đối diện để chuyển lựa chọn. Ví dụ một upvote và một downvote hiển thị `↑ 1` và `↓ 1`, không gộp thành điểm 0 trên giao diện.
- `community.routes.js` trả tổng từng loại cho bình luận phim; `posts.routes.js` trả tổng cho bài viết, câu hỏi và bình luận của chúng. Các số được lấy từ bản ghi vote, không tự tạo collection hoặc sửa dữ liệu cũ. Điểm `score` vẫn là upvote trừ downvote cho các phần phụ thuộc hiện có.
- Integration smoke dùng `community_test_schema_20261101`: kiểm tra đổi chiều, bỏ vote và hai người dùng chọn hai chiều. Kiểm thử trình duyệt dùng API giả lập: hiển thị hai số, đổi chiều và bấm nhanh khi yêu cầu đang xử lý. ESLint các file liên quan và frontend build đạt; build còn cảnh báo bundle lớn.
- Backend local đã được khởi động lại; GET bình luận phim trả HTTP 200 và có cả `upvotes`, `downvotes`. Đây là kiểm tra chỉ đọc trên ứng dụng, chưa xác nhận vote bằng tài khoản thật hoặc kiểm tra trực quan toàn bộ trường hợp trên dữ liệu thật.
