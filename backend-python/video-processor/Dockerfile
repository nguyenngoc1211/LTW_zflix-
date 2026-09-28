# Dùng Python bản nhỏ gọn
FROM python:3.9-slim

WORKDIR /app

# Cài các thư viện cần thiết cho video (ffmpeg...)
RUN apt-get update && apt-get install -y ffmpeg

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Giả sử service này chạy port 8001
EXPOSE 8001

# Chạy app bằng Uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]