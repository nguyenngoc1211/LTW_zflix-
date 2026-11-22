# Lensy catalog CLIP V2

Phạm vi: chỉ nhánh CLIP khi `VISION_PROVIDER=none`. DeepSeek giữ nguyên hành vi;
Gemini đã bị gỡ khỏi Vision provider Node.

## Cấu hình

```env
VISUAL_EXACT_MAX_VECTORS=10000
VISUAL_HNSW_EF=100
VISUAL_TOP1_MIN_SCORE=0.6
VISUAL_TOP1_MARGIN=0.001
```

- V2 luôn bật cho nhánh CLIP; không còn flag V1/V2.
- `VISUAL_EXACT_MAX_VECTORS`: dùng cosine exact khi số vector nhỏ hơn ngưỡng.
- `VISUAL_HNSW_EF`: efSearch khi phải dùng HNSW.
- `VISUAL_TOP1_MIN_SCORE` và `VISUAL_TOP1_MARGIN`: chặn kết quả không chắc chắn.
- Ảnh gốc được tìm trước; chỉ dùng thêm tight/padded view khi ảnh gốc dưới ngưỡng.

## Demo Endgame local

Ảnh/video demo để trong `%LOCALAPPDATA%\Temp\opencode\endgame-demo`, không commit.

```powershell
npm run demo:endgame:seed -- --fixture "$env:LOCALAPPDATA\Temp\opencode\endgame-demo" --reset
npm run benchmark:visual -- --fixture "$env:LOCALAPPDATA\Temp\opencode\endgame-demo"
npm run demo:endgame:cleanup
```

Manifest do script seed tạo gồm `object`, `productId` và danh sách ảnh query.
Benchmark báo top-1/top-5/MRR và độ ổn định top-1 qua các frame.
Bộ hiện tại có 22 món: bàn, ghế, tủ lạnh, sofa, quạt, đĩa, thìa, máy giặt,
bếp ga, bàn là, máy hút bụi, máy sấy tóc, laptop, bát, nồi, chảo, nồi cơm điện,
ổ cắm, bộ ấm chén, màn ngủ, đồng hồ báo thức và giá sách.

## Chạy demo tách riêng

Không đổi stack DeepSeek đang chạy ở `3000/5173`. Demo CLIP dùng cổng riêng:

```powershell
# Backend CLIP V2
$env:PORT='3005'; $env:VISION_PROVIDER='none'
$env:FRONTEND_ORIGIN='http://localhost:5174'
node --env-file=.env src/server.js

# Frontend trỏ vào backend demo
$env:VITE_API_URL='http://localhost:3005'
npm run dev -- --port 5174 --host 0.0.0.0
```

Mở `http://localhost:5174`, vào phim Avengers: Endgame và quét các món đã seed.

## Kết quả fixture hiện tại

22 đồ vật, 44 frame query: top-1 100%, top-5 100%, MRR 1.0, top-1 ổn định
qua 2 frame cho mỗi vật. V2 mất khoảng 227ms vì luôn tạo 3 view; chỉ dùng view
phụ khi ảnh gốc dưới ngưỡng tin cậy.
