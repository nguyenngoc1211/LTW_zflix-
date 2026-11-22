# Testcase: Elasticsearch và lọc bình luận an toàn

Cập nhật lần cuối: 2026-11-22.

## Elasticsearch

Unit test nằm trong `backend-node/test/search-cases.test.js`. Smoke test dùng API và
Elasticsearch thật nằm trong `backend-node/integration/search-cases-smoke.js`.

| ID | Mục tiêu | Dữ liệu/đầu vào | Kỳ vọng | Loại |
| --- | --- | --- | --- | --- |
| ES-01 | Tìm đúng tên phim | `search=Interstellar` | Trả phim `Interstellar` | Unit + smoke API |
| ES-02 | Không phân biệt hoa/thường | `search=iNtErStElLaR` | Trả phim `Interstellar` | Unit + smoke API |
| ES-03 | Sai một ký tự | `search=crush` | Trả phim `Crash Landing On You` | Unit + smoke API |
| ES-04 | Dự phòng khi ES lỗi | ES ném lỗi | Gọi fallback database và trả kết quả | Unit |
| ES-05 | Chỉ lọc thể loại | `genre=Bí ẩn` | Mọi kết quả có thể loại `Bí ẩn` | Unit + smoke API |
| ES-06 | Chỉ lọc quốc gia | `country=UK` | Mọi kết quả có `country=UK` | Unit + smoke API |
| ES-07 | Chỉ lọc năm | `year=1999` | Mọi kết quả có `release_year=1999` | Unit + smoke API |
| ES-08 | Chỉ lọc điểm | `minRating=4` | Mọi kết quả có `rating_avg >= 4` | Unit + smoke API |
| ES-09 | Không bật bộ lọc | Không truyền filter | Trả toàn bộ catalog phim và series | Unit + smoke API |
| ES-10 | Sắp xếp năm mới nhất | `sortYear=desc` | Danh sách giảm dần theo `release_year` | Unit + smoke API |

ES-05 đến ES-09 dùng `match_all` kèm tối đa một điều kiện lọc. ES-10 chỉ thay đổi
`sort`, không thêm điều kiện lọc. ES-09 được dùng làm case nền cho trường hợp không
nhập từ khóa và không chọn bộ lọc.

Chạy:

```powershell
cd backend-node
npm test
npm run test:search-cases
```

`test:search-cases` cần backend, Elasticsearch và index `productions` đang hoạt động.

## Lọc bình luận an toàn

Unit test nhận diện từ ngữ nằm trong `backend-node/test/toxic-comment-cases.test.js`.
Smoke test trình duyệt nằm trong `frontend/tests/toxic-comment-safety-smoke.mjs`.

| ID | Mục tiêu | Dữ liệu/đầu vào | Kỳ vọng | Loại |
| --- | --- | --- | --- | --- |
| CM-01 | Phát hiện từ vi phạm tiếng Việt | `cặc` | `isToxic=true`, match `cặc` | Unit |
| CM-02 | Phát hiện từ vi phạm tiếng Anh | `fuck` | `isToxic=true`, match `fuck` | Unit |
| CM-03 | Chuẩn hóa ký tự thay thế | `@ss` | Chuẩn hóa thành `ass`, `isToxic=true` | Unit |
| CM-04 | Không bắt nhầm từ hợp lệ | `lồng ngực` | `isToxic=false` | Unit |
| CM-05 | Vẫn cho đăng comment bị cảnh báo | Đăng `Bình luận này có cặc` | API trả thành công, form xóa nội dung, UI hiện cảnh báo | Browser smoke với API mock |
| CM-06 | Làm mờ và mở nội dung | Comment có `is_toxic=1` | Nội dung bị che; nhấn vào thì mở và không còn blurred | Browser smoke |
| CM-07 | Cập nhật trạng thái khi sửa | Sửa `lồng tiếng` thành `lồn` | Bộ lọc đổi từ an toàn sang vi phạm; UI làm mờ nội dung mới | Unit + browser smoke |

CM-05 kiểm tra contract phía client với response `isToxic=true` và `warning`; route
backend hiện lưu comment với cờ toxic thay vì từ chối. CM-06 và CM-07 kiểm tra component
`ToxicComment` cùng luồng tải lại comment sau khi sửa.

Chạy:

```powershell
cd backend-node
npm test

cd ..\frontend
npm run test:comment-safety
```
