# Báo cáo build và kiểm thử branch Hai

Ngày kiểm tra: 19/10/2026.

## Môi trường

- Docker Desktop 29.6.1.
- MySQL 8.0.
- Elasticsearch 8.15.5, single-node.
- Node 22 Alpine cho frontend/backend.
- Python 3.9 Slim cho hai service Python.

## Kết quả

| Hạng mục | Kết quả |
| --- | --- |
| Build backend Node không dùng cache | Pass |
| Build frontend không dùng cache | Pass |
| Build video processor không dùng cache | Pass |
| Build AI chatbot không dùng cache | Pass |
| MySQL healthcheck | Healthy |
| Elasticsearch healthcheck | Healthy |
| Elasticsearch index `productions` | 50 documents |
| Backend unit tests | 4/4 pass |
| Frontend ESLint trong container | Pass |
| Frontend `/` và `/movies/1` | HTTP 200 |
| Backend health, filters, search, combined filters, detail | HTTP 200 |
| Video processor và AI chatbot | HTTP 200 |

Tìm kiếm thực tế với `search=DaRk%20KnIgHt` trả đúng duy nhất `The Dark Knight`,
xác nhận analyzer không phân biệt chữ hoa/thường. Bộ lọc kết hợp
`country=USA&year=2019&minRating=4&sortYear=desc` trả dữ liệu phù hợp.

API cá nhân được kiểm tra ở trạng thái chưa merge Du và trả đúng
`503 AUTH_MODULE_NOT_INTEGRATED` (fail-closed). Regression auth/ownership đầy đủ
cần chạy lại sau khi hai branch được tích hợp.

Elasticsearch có thể hiển thị cluster `yellow` trong chế độ single-node do replica
không thể phân bổ; primary shard và toàn bộ chức năng tìm kiếm vẫn hoạt động.
