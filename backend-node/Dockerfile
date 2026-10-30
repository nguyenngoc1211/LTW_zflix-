FROM node:22-bookworm-slim

WORKDIR /app

# onnxruntime-node (CLIP cho Lensy) là binary glibc, không chạy trên Alpine/musl.
# hnswlib-node cần toolchain để node-gyp biên dịch; libgomp1 cho onnxruntime.
# openssl để Prisma phát hiện đúng libssl 3.x.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Giả sử backend chạy port 3000
EXPOSE 3000

# Lệnh chạy dev (nhớ cài nodemon hoặc ts-node-dev trong package.json)
CMD ["npm", "run", "start"]
