# Báo cáo phiên triển khai và kiểm chứng Notification P0–P1

Ngày tổng hợp: 2026-11-08. Dự án: `D:\LTW` (frontend React/Vite, backend Express/Node.js, MongoDB, Socket.IO). Báo cáo này gom công việc P0 đã có trong workspace và phần P1 được triển khai, kiểm chứng trong phiên. Mã nguồn hiện tại là căn cứ khi tài liệu cũ khác với code. Chưa commit hoặc push.

## 1. Phạm vi và trạng thái ban đầu

- Hệ thống đã có collection `notifications`, route danh sách/đánh dấu đã đọc và các luồng nội dung, tài khoản, VIP. P0 sử dụng lại các phần này, thêm `NotificationService`, job và giao diện; P1 tiếp tục mở rộng cùng hệ thống, không tạo collection notification thứ hai.
- Trước khi làm P1, workspace đã có nhiều thay đổi P0 chưa commit. Các thay đổi đó được giữ lại; trạng thái Git cuối phiên vẫn là các file modified/untracked, không có commit mới.
- Đã đọc `docs/AUTH_SECURITY_PROGRESS.md`, kiểm tra Git status/log và source trước các thay đổi liên quan xác thực/quyền. Tài liệu tiến độ bảo mật được cập nhật sau phần quyền truy cập preferences/mention.

## 2. P0 — các phần đã triển khai và kiểm chứng

### 2.1 Bình luận và bài viết

- Bình luận phim và bình luận bài viết cộng đồng xác định trực tiếp chủ bình luận cha. Reply nhiều cấp chỉ gửi cho chủ bình luận cha gần nhất; bình luận trực tiếp trên bài gửi cho chủ bài viết. Không gửi khi tự trả lời/tự bình luận.
- Tạo nội dung và tạo notification trong cùng MongoDB transaction ở các luồng Mongo liên quan. Notification được lưu trước khi phát realtime; người nhận offline vẫn đọc được sau khi quay lại.
- `Idempotency-Key` cho request tạo bình luận; khóa được gắn với user và fingerprint nội dung. Retry cùng request trả lại comment cũ; cùng khóa nhưng nội dung khác trả 409.
- Deep link dùng `commentId`, tìm đường phân trang của bình luận cộng đồng, cuộn và làm nổi bật bình luận đích. Nội dung bị xóa được xử lý theo trạng thái hiện có thay vì tạo route giả.

### 2.2 Tập phim mới

- Job `notification_jobs` được enqueue ở các luồng tạo/phát hành tập thực sự tồn tại: admin, discovery API và streaming service sau xử lý video. Import dữ liệu lịch sử và chỉnh sửa tập cũ không enqueue.
- Worker chỉ gửi cho tập có video và không ở trạng thái draft/hidden. Người từng xem, yêu thích hoặc theo dõi được hợp nhất và loại trùng; thông báo mở `/watch-episode/:episodeId`.
- Job có claim token, lease/heartbeat, retry/backoff và deduplication key. Chạy lại worker không tạo thêm notification cho cùng tập/người nhận. Worker chạy ở backend, không phụ thuộc có người mở website.

### 2.3 Bảo mật, VIP và quyền

- Đổi mật khẩu và reset mật khẩu thành công ghi notification `security` cùng transaction với thay đổi tài khoản; thất bại không tạo notification. Realtime chỉ phát sau commit.
- Admin cấp VIP thủ công ghi giao dịch, subscription và thông báo kích hoạt trong transaction Mongo. Job thông báo VIP hết hạn dùng `users.vip_expires_at`; không giả định thanh toán định kỳ.
- Danh sách, unread count, đánh dấu đã đọc, đánh dấu tất cả và xóa chỉ thao tác trên `req.user.id` từ token/session đã xác minh. User A không đọc/xóa notification của B.
- Socket.IO `/notifications` tái sử dụng xác thực JWT cộng session database của Watch Party, tự vào room `user:<id>` từ danh tính server. Client không chọn room của người khác; Watch Party không bị thay đổi nghiệp vụ.

### 2.4 API, schema và giao diện P0

- API: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`, `DELETE /api/v1/notifications/:id`. Danh sách Mongo có pagination, bộ lọc và validation.
- Notification Mongo lưu user/actor, loại, tiêu đề, nội dung, đích điều hướng, metadata, trạng thái đọc, thời gian, deduplication key. Index phục vụ danh sách theo user/thời gian, unread và khóa chống trùng. Dữ liệu cũ vẫn đọc được.
- `NotificationBell` hiện badge, dropdown, avatar/poster, thời gian tương đối và đồng bộ sau reconnect/reload; mở dropdown không tự đánh dấu tất cả đã đọc. `NotificationsPage` có bộ lọc, phân trang, loading/empty/error, thao tác đọc/xóa và deep link.

## 3. P1 — phần triển khai thêm trong phiên

### 3.1 Notification Preferences

- Lưu sáu khóa trong `users.notification_preferences`: `episode_updates`, `comment_replies`, `post_comments`, `mentions`, `likes`, `vip_reminders`. User cũ không cần migration: khóa thiếu mặc định `true`.
- `NotificationService` kiểm tra preference ở backend trước khi tạo notification. `security`, thông báo giao dịch/quản trị và `vip_expired` không phụ thuộc các công tắc tương tác.
- `GET/PATCH /api/v1/notifications/preferences` yêu cầu đăng nhập, chỉ đọc/sửa user hiện tại, chỉ nhận boolean của sáu khóa cho phép. Trang `/settings` có section Thông báo với trạng thái từ API, loading/error/success, tối ưu cập nhật và đọc lại trạng thái server nếu lưu lỗi.

### 3.2 @Mention

- Server tách tối đa 20 `@username` khác nhau từ bài viết, bình luận cộng đồng và bình luận phim; tra user active bằng username chính xác, lưu `mention_user_ids` ổn định vào nội dung. Không tin recipient do frontend cung cấp.
- Không gửi cho chính người viết, username không tồn tại hoặc nhiều lần nhắc cùng user. Khi người được mention cũng là chủ comment cha/chủ bài, ưu tiên notification reply/post comment để một sự kiện không gửi hai lần. Notification mention có deduplication key theo nội dung và người nhận.
- Bài thường, bài có ảnh và comment có `Idempotency-Key` theo request; retry không tạo lại nội dung/notification. Edit chỉ sửa nội dung, không phát mention mới do chỉnh định dạng hoặc thêm mention lúc edit.
- Autocomplete `GET /api/v1/users/mention-suggestions?q=...` yêu cầu session, giới hạn 30 request/phút, prefix dài 1–30 ký tự và tối đa 8 kết quả; chỉ trả ID, username, avatar. Editor dùng textarea hiện có với chọn chuột/phím, React render text an toàn và tô nổi `@username`. Không có route hồ sơ công khai nên mention chưa gắn liên kết hồ sơ.

### 3.3 Like Notifications

- Tích hợp vào vote `+1` thành công của bài cộng đồng, bình luận cộng đồng và bình luận phim. Không thông báo cho chính chủ nội dung hoặc người đã tắt `likes`.
- Collection phụ `notification_like_events` giữ khóa actor + loại/ID nội dung và thời gian phát gần nhất để chống spam unlike/like trong 24 giờ. Đây là dữ liệu cooldown, không phải collection notification thứ hai.
- Một notification tổng hợp cho mỗi người nhận/nội dung. Người like mới cập nhật bản ghi và mở lại trạng thái unread nếu đã đọc; không thêm hàng trăm notification riêng. Số người like loại trừ lượt tự like của chủ nội dung. Unlike tính lại số hiện tại, xóa aggregate nếu còn 0, rồi báo client đồng bộ.
- Socket gửi `notification:new` cho bản ghi tạo/cập nhật và `notification:changed` khi cần refresh; Bell và trang danh sách tải lại dữ liệu/count từ API, tránh bản sao giữa các tab.

### 3.4 Episode Notification Batching

- Hai API admin tạo tập hiện có nhận thêm `publicationBatchId` (8–80 ký tự URL-safe) và `publicationBatchComplete` (boolean). Cùng batch ID phải dùng cho cả đợt, request cuối đặt `publicationBatchComplete: true`.
- Job ở `awaiting_batch` cho tới khi đóng batch. Nếu cập nhật thất bại giữa chừng, caller có thể tiếp tục cùng ID; batch đã đóng/đang xử lý từ chối thêm tập mới. Không có batch ID thì giữ hành vi một tập P0.
- Worker chọn các tập đã phát hành/xem được, gửi một notification mỗi user/batch, lưu số tập và khoảng số tập trong metadata, mở tập mới nhất xem được. Khóa job và deduplication key chặn retry, người vừa xem vừa theo dõi chỉ nhận một bản ghi. Preferences được đọc theo nhóm tối đa 200 user thay vì truy vấn từng recipient.
- Giao diện P0 hiển thị nội dung và poster của notification gộp; notification một tập cũ vẫn đọc/điều hướng được. Admin UI hiện tạo từng tập, chưa có form đăng nhiều tập; để gộp nhiều request, caller phải truyền batch ID tường minh.

### 3.5 VIP Expiration Reminders

- Mở rộng job VIP hiện có để gửi mốc trong vòng 7 ngày và 1 ngày trước hạn, dựa trên `users.vip_expires_at` và subscription `active` có `end_date` trùng chu kỳ hiện tại. Dữ liệu subscription đã hủy/không còn phù hợp không nhận reminder.
- Deduplication key phân biệt user, subscription, hạn mới và mốc 7/1 ngày. Marker trên user giúp job chạy lại không gửi lặp; cửa sổ kiểm tra đủ rộng để không bỏ sót chỉ vì job không chạy đúng giờ. Gia hạn thủ công đổi hạn thì dùng chu kỳ mới.
- VIP hết hạn vẫn là thông báo bắt buộc. Icon VIP và deep link dùng `/settings?tab=profile`, route đang tồn tại.

## 4. File liên quan

| Nhóm | File chính | Vai trò |
| --- | --- | --- |
| Backend chung P0/P1 | `backend-node/src/modules/community/notification.service.js`, `community.routes.js`, `posts.routes.js` | Tạo/lấy/đếm/đọc/xóa, preference, comment, mention, like và realtime |
| Backend P0 | `comment-idempotency.js`, `episode-notification.job.js`, `vip-expiration.job.js`, `backend-node/src/server.js` | Retry comment, job tập/VIP, Socket.IO namespace và scheduler |
| Backend nghiệp vụ P0 | `backend-node/src/modules/auth/auth.mongo.service.js`, `auth.routes.js`, `admin/admin.system.routes.js`, `admin/admin.content.routes.js`, `discovery/discovery.routes.js`, `streaming/services/episode.service.js` | Bảo mật, cấp VIP, enqueue tập mới |
| Backend P1 | `notification-preferences.js`, `mention.service.js`, `like-notification.service.js` | Sáu preference, recipient mention, cooldown/aggregate like |
| Frontend P0 | `frontend/src/components/NotificationBell.jsx`, `modules/community/NotificationsPage.jsx`, `modules/community/PostComments.jsx`, `components/streamingPage/MovieCommentItem.jsx`, `utils/commentRequest.js`, `utils/notificationTime.js`, các route/Header liên quan | Chuông, danh sách, deep link, retry comment |
| Frontend P1 | `frontend/src/modules/auth/NotificationPreferencesSection.jsx`, `modules/auth/SettingsPage.jsx`, `components/community/MentionTextarea.jsx`, `components/community/UnifiedComment.jsx`, `components/streamingPage/CommentSection.jsx`, `modules/community/CommunityPage.jsx`, `utils/notificationIcon.js`, `index.css` | Settings, autocomplete, highlight, icon, responsive styling |
| Test/tài liệu | `backend-node/integration/notification-p0-smoke.js`, `notification-p1-smoke.js`, `backend-node/test/notification-rules.test.js`, `notification-p1-rules.test.js`, `docs/AUTH_SECURITY_PROGRESS.md`, file này | Regression, integration/browser smoke, ghi nhận quyền và vận hành |

Các đường dẫn trong bảng tính từ gốc repo `D:\LTW`. Nhiều file P0 ở trên đã là thay đổi chưa commit khi bắt đầu phần P1; bảng này mô tả trạng thái công việc P0–P1, không phải danh sách file vừa mới tạo trong một lệnh.

## 5. Môi trường và kiểm thử thực tế

- Đã kiểm tra `.env` gốc: `MONGODB_DB_NAME=Zflix` và `COMMUNITY_TEST_MONGODB_URI` **trùng** `MONGODB_URI` chính. `backend-node/.env` không có biến test này. Không dùng URI đó cho test ghi dữ liệu.
- Dùng container MongoDB 7 tạm, replica set `rs0`, chỉ bind `127.0.0.1:27018`. Integration script chỉ chấp nhận URI localhost cổng này, tự tạo database `notification_test_*` hoặc `notification_p1_test_*`, xác nhận replica set và xóa database riêng trong `finally`.
- Sau kiểm thử đã xác nhận không còn database có tiền tố `notification_` trong container test rồi dừng container. Không ghi vào `Zflix`.

| Kiểm tra | Kết quả | Bằng chứng/phạm vi |
| --- | --- | --- |
| Backend unit tests | **PASS** | 78/78, gồm rule P0 và parser/preference P1 |
| P0 integration | **PASS** | Đăng nhập 2 user; reply, tự reply, nhiều cấp, retry; post comment; owner/unread; tập mới/lease/retry/draft/import; security success/failure; offline/reconnect/nhiều tab |
| P1 integration | **PASS** | Sáu preference; mention hợp lệ/nhiều/trùng/tự/không tồn tại/HTML/retry; like 3 loại, opt-out, cooldown, aggregate/unread; batch mở/đóng/retry/opt-out; VIP 7/1 ngày, gia hạn, hủy, hết hạn/retry |
| P0 browser smoke | **PASS** | Bell, dropdown, bộ lọc, unread, mark-all và deep link bình luận/tập |
| P1 browser smoke | **PASS** | Settings toggle lưu DB, autocomplete chọn bằng chuột qua UI, danh sách notification P1 |
| Frontend ESLint | **PASS** | 0 lỗi; còn 3 warning hook cũ ở `LibraryPage.jsx` và `PartyRoom.jsx` |
| Frontend production build | **PASS** | Vite build thành công; còn cảnh báo bundle lớn/dynamic import cũ |
| Backend syntax check | **PASS** | 21 file backend thay đổi/chưa track được kiểm tra |
| `git diff --check` | **PASS** | Exit 0; Git báo cảnh báo chuyển LF/CRLF cho `NotificationsPage.jsx` |
| R2 upload thật, tải lớn, production-equivalent deploy | **NOT RUN** | Không có môi trường an toàn/tương đương được xác nhận trong phiên |

Các lỗi kiểm thử trung gian đã được sửa trước vòng cuối: fixture socket P1 thiếu `auth_sessions.id`; assertion like sau unlike/like không khớp quy tắc cooldown; browser assertion chạy trước khi PATCH settings hoàn tất; selector browser match nhiều thông báo like. Vòng kiểm thử cuối của các phần đó đều PASS.

## 6. Giới hạn và rủi ro trước deploy

1. **Chưa production-ready:** chưa thử trên topology/deploy tương đương production, đặc biệt replica set cho transaction, Socket.IO qua proxy và worker nhiều instance.
2. Biến `COMMUNITY_TEST_MONGODB_URI` trong `.env` gốc còn trỏ vào URI chính. Cần thay bằng cấu hình test thật trước khi đưa integration test vào CI; không chạy test ghi dữ liệu với biến hiện tại.
3. Batch nhiều tập chỉ gộp khi caller truyền cùng `publicationBatchId` và đóng batch. Admin UI hiện tạo một tập mỗi lần; không có suy đoán gom các đợt phát hành độc lập.
4. Mention khớp username chính xác, phân biệt chữ hoa/thường để dùng index hiện có. Chưa có route hồ sơ công khai nên mention được tô nổi nhưng không dẫn đến profile. Edit không phát mention mới theo quy tắc đã chọn.
5. Upload ảnh thật qua R2 và retry multipart trên dịch vụ lưu trữ thực chưa được integration test. Chọn mention bằng bàn phím đã có trong code nhưng chưa có browser assertion riêng. Kiểm thử tải hàng nghìn người theo dõi/like và cạnh tranh đồng thời lớn cũng chưa chạy.
6. Job VIP được gọi trực tiếp trong integration test; lịch chạy theo giờ và múi giờ/độ trễ trên môi trường triển khai cần smoke test riêng trước release.

## 7. Trạng thái bàn giao

P0 và năm module P1 đã được thực hiện bằng code, kiểm thử unit/integration/browser trên môi trường test riêng, lint/build/syntax/diff đều đạt theo phạm vi bảng trên. Các giới hạn ở mục 6 cần giải quyết hoặc xác nhận trước production. Không commit, không push, không chạy test ghi dữ liệu trên database chính.

## 8. Bổ sung ngày 2026-11-09: sửa deep link reply, autoplay và dropdown trên bản local

### 8.1 Lỗi và nguyên nhân

1. Notification trả lời bình luận phim lưu URL `/movies/:productionId?commentId=:commentId`. Bình luận phim chưa lưu episode ID, còn route `/watch-episode/:episodeId` làm rơi `commentId` khi chuyển sang URL xem phim chuẩn. Trang xem dùng danh sách bình luận phân trang nên reply nhiều cấp không chắc được render để cuộn/highlight.
2. Player cũ có thuộc tính `autoPlay` trên video của `PlayerPage`; `VideoPlayer` còn gọi `video.play()` trong effect ngay khi nhận tập đầu tiên nếu Auto Play đang bật.
3. Header tạo stacking context ở `z-index: 10`, thấp hơn khối player `z-index: 50`; nâng riêng dropdown bên trong header không đủ để đưa nó lên trên player.

### 8.2 Thay đổi đã thực hiện

- Khi gửi bình luận từ trang xem, frontend truyền `episodeId` của tập đang xem. Backend xác minh tập thuộc phim hoặc season của series, lưu `episode_id` trong comment MongoDB; reply kế thừa `episode_id` của comment cha khi có. `NotificationService` dùng ID đã lưu để tạo `/watch-episode/:episodeId?commentId=:commentId`, kèm `episodeId` trong metadata. Request comment có `Idempotency-Key` đưa episode ID vào fingerprint để không tái sử dụng cùng key với ngữ cảnh khác.
- `EpisodeRedirect` giữ `commentId` hợp lệ khi tạo URL xem phim chuẩn. Khi URL có `commentId`, `MovieDiscussion` render `CommentSection` hiện có với toàn bộ bình luận để tìm, cuộn và áp dụng lớp `notification-target` cho đúng reply, kể cả nhiều cấp. Luồng bình luận thông thường vẫn dùng danh sách phân trang.
- Bỏ thuộc tính `autoPlay` ở `PlayerPage`. `VideoPlayer` chỉ cho effect Auto Play hoạt động sau khi video đã nhận sự kiện `onPlay` do người dùng khởi phát; vào trang và reload không tự phát. Logic `pos`, seek, lưu tiến độ và xem tiếp không bị sửa.
- Nâng stacking context của `.site-header` lên `z-index: 120` khi dropdown thông báo đang mở. Giữ nguyên component và thao tác của chuông thông báo.

File sửa cho đợt này: `backend-node/src/modules/community/community.routes.js`, `notification.service.js`, `backend-node/integration/notification-p0-smoke.js`, `frontend/src/components/streamingPage/CommentSection.jsx`, `MovieCommentItem.jsx`, `AllDiscussion.jsx`, `MovieDiscussion.jsx`, `VideoPlayer.jsx`, `frontend/src/modules/streaming/EpisodeRedirect.jsx`, `PlayerPage.jsx`, `frontend/src/index.css`. Các thay đổi UI thông báo đã có sẵn trong working tree ở `NotificationBell.jsx`, `NotificationsPage.jsx` và `index.css` được giữ lại; không hoàn nguyên hoặc commit.

### 8.3 Kiểm thử và trạng thái local

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| Backend unit | **PASS** | 78/78 sau khi đặt `FRONTEND_ORIGIN=http://localhost:5173` cho test; lần chạy đầu với origin khác có 2 assertion auth thất bại do cấu hình môi trường, lần chạy đúng cấu hình đạt 78/78. |
| P0 integration | **PASS** | MongoDB 7 replica set `rs0` tạm tại `127.0.0.1:27018`, URI `directConnection=true`, database `notification_test_*`; xác nhận reply kế thừa episode ID và URL mới, retry, realtime, quyền sở hữu, offline và regression P0. |
| Browser smoke | **PASS** | Bell/dropdown click được; deep link qua `/watch-episode/:episodeId` tới URL xem chuẩn, đúng comment có `notification-target`; video pause lúc vào trang và sau reload. Test dùng frontend Vite mới với backend/Mongo test riêng. |
| Frontend ESLint | **PASS** | 0 lỗi; còn 3 warning hook có sẵn tại `LibraryPage.jsx` và `PartyRoom.jsx`. |
| Frontend build | **PASS** | Vite build thành công; còn cảnh báo chunk lớn/dynamic import trước đó. |
| Backend syntax; `git diff --check` | **PASS** | Các file backend vừa sửa hợp lệ; diff không có lỗi whitespace. |
| Bản local | **PASS** | Đã build và tạo lại container `backend-node`, `frontend`; backend health trả `ok`, frontend `http://localhost:5173/` trả HTTP 200, cả hai container dùng source mới. |

Sau test, container MongoDB test đã dừng; danh sách database còn `admin`, `config`, `local`, không còn database `notification_test_*`. Không ghi test vào `Zflix` và không commit/push.

**Giới hạn dữ liệu cũ:** notification/comment phim tạo trước thay đổi này không có episode ID. Không thể suy ra chính xác tập từ dữ liệu đó, nên URL cũ có thể vẫn mở trang chi tiết phim. Luồng mới từ trang xem đã được kiểm chứng; chưa kiểm thử trên môi trường triển khai tương đương production.
