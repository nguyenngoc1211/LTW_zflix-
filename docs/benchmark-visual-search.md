# CLIP visual search benchmark (historical run)

| Thuộc tính | Giá trị |
|---|---|
| Ngày đo | 26/10/2026 |
| Catalog tại lần đo | 11 sản phẩm |
| Model | `Xenova/clip-vit-base-patch32`, quantized ONNX chạy CPU |
| Index | HNSW trong process (`hnswlib-node`), cosine, vector 512 chiều |

> Đây là số đo cũ trên catalog demo, không phải benchmark của commit hiện tại. Query dùng chính ảnh catalog làm đầu vào; một số URL ảnh mẫu không khớp tên sản phẩm. Vì vậy tỷ lệ 11/11 chỉ xác nhận truy hồi self-query trong bộ dữ liệu nhỏ, không đo độ chính xác nhận diện ảnh crop từ phim.

## Kết quả ghi nhận ở lần đo đó

| Chỉ số | Giá trị |
| --- | --- |
| Thời gian embed trung bình | **40ms/ảnh** |
| Thời gian vector search trung bình | **0ms** |
| Tổng thời gian server (embed + search) | **40ms** |
| Top-1 hit rate (query là ảnh cùng sản phẩm trong catalog) | **100%** (11/11) |
| Top-3 hit rate trong cùng điều kiện self-query | **100%** (11/11) |

## Chi tiết từng sản phẩm

| Sản phẩm | Embed (ms) | Search (ms) | Tổng (ms) | Top-1 | Top-3 |
| --- | --- | --- | --- | --- | --- |
| Cốc sứ cà phê đen | 49 | 0 | 49 | ✓ | ✓ |
| Bàn cà phê mặt gạch men | 42 | 1 | 43 | ✓ | ✓ |
| Ghế sắt ngoài trời | 48 | 0 | 48 | ✓ | ✓ |
| Chậu cây cảnh trong nhà | 39 | 0 | 39 | ✓ | ✓ |
| Máy pha cà phê drip | 42 | 0 | 42 | ✓ | ✓ |
| Khăn giấy ăn khối | 42 | 0 | 42 | ✓ | ✓ |
| Muỗng inox 304 | 35 | 0 | 35 | ✓ | ✓ |
| Khay gỗ serving | 37 | 0 | 37 | ✓ | ✓ |
| Ly thủy tinh chịu nhiệt | 32 | 1 | 33 | ✓ | ✓ |
| Bình giữ nhiệt inox | 34 | 0 | 34 | ✓ | ✓ |
| Đèn trang trí quán cà phê | 38 | 0 | 38 | ✓ | ✓ |

## So sánh kiến trúc tham khảo

| Khía cạnh | ResNet + Qdrant + Triton (repo mẫu) | CLIP + hnswlib (Zflix) |
| --- | --- | --- |
| Model | ResNet/EfficientNet, ONNX → TensorRT, cần NVIDIA GPU | CLIP quantized ONNX, chạy CPU, load sẵn RAM |
| Hạ tầng | Triton Inference Server + Qdrant + PostgreSQL + Elasticsearch | In-process trong Node, không thêm service |
| Vector search | HNSW (Qdrant) | HNSW (hnswlib-node) — cùng thuật toán |
| Độ trễ search | ~1-5ms (network + Qdrant) | ~0ms (in-process) |
| Ngữ nghĩa | ResNet: giống trực quan | CLIP: giống trực quan + hiểu ngữ nghĩa (màu, phong cách) |
| Phù hợp | Nhiều node hoặc hạ tầng GPU chuyên dụng | Catalog nhỏ đến vừa, tùy cấu hình và kết quả benchmark thực tế |

## Kết luận

- 40 ms là thời gian embed + vector search được đo trong lần chạy này; không gồm toàn bộ thời gian crop, OCR, đọc DB và trả response.
- Ảnh query trùng ảnh dùng để tạo embedding, nên kết quả 11/11 không đại diện cho ảnh crop khác góc, ánh sáng hoặc nền từ phim.
- Ngưỡng similarity mặc định trong code là 0.6. Chỉ nên điều chỉnh sau khi có tập ảnh kiểm thử độc lập, có nhãn và ghi nhận false positive/false negative.
- Code hiện tại lưu một embedding chính và tối đa bốn vector ảnh phụ cho mỗi sản phẩm; index gộp các vector về cùng sản phẩm và giữ điểm cao nhất. Khả năng mở rộng index cần benchmark theo catalog thực và tài nguyên máy; chưa có ngưỡng số lượng sản phẩm được xác nhận để chuyển sang dịch vụ khác.
