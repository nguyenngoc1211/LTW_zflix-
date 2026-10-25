# 📊 Benchmark AI Visual Search — CLIP ViT-B/32 + hnswlib HNSW

**Ngày đo:** 03:04:23 26/10/2026
**Catalog:** 11 sản phẩm | **Model:** Xenova/clip-vit-base-patch32 (quantized ONNX, CPU)
**Index:** HNSW in-process (hnswlib-node), metric cosine, 512 chiều

## Kết quả đo thực tế

| Chỉ số | Giá trị |
| --- | --- |
| Thời gian embed trung bình | **40ms/ảnh** |
| Thời gian vector search trung bình | **0ms** |
| Tổng thời gian server (embed + search) | **40ms** |
| Top-1 hit rate (quét chính item đó) | **100%** (11/11) |
| Top-3 hit rate | **100%** (11/11) |

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

## So sánh với kiến trúc ResNet + Qdrant + Triton (search-engine-system)

| Khía cạnh | ResNet + Qdrant + Triton (repo mẫu) | CLIP + hnswlib (Zflix) |
| --- | --- | --- |
| Model | ResNet/EfficientNet, ONNX → TensorRT, cần NVIDIA GPU | CLIP quantized ONNX, chạy CPU, load sẵn RAM |
| Hạ tầng | Triton Inference Server + Qdrant + PostgreSQL + Elasticsearch | In-process trong Node, không thêm service |
| Vector search | HNSW (Qdrant) | HNSW (hnswlib-node) — cùng thuật toán |
| Độ trễ search | ~1-5ms (network + Qdrant) | ~0ms (in-process) |
| Ngữ nghĩa | ResNet: giống trực quan | CLIP: giống trực quan + hiểu ngữ nghĩa (màu, phong cách) |
| Phù hợp | Scale lớn, nhiều node GPU | MVP/đồ án, catalog ≤ hàng chục nghìn |

## Kết luận

- Tổng 40ms server-side đạt mục tiêu real-time (<500ms) — người dùng
  thấy kết quả gần như tức thời sau khi thả linh vật.
- Top-1 100% trên ảnh catalog là mức lý tưởng (truy vấn chính là ảnh catalog —
  hệ số nhiễu 0); với ảnh quét thực tế (crop khác góc sáng) độ giống giảm nhưng
  vẫn đúng chủ đề nhờ CLIP.
- Khi catalog vượt ~100k sản phẩm: migrate hnswlib in-process sang pgvector/Qdrant
  (giữ nguyên interface searchByVector) — đã ghi trong README.
