FROM node:22-alpine

WORKDIR /app

# hnswlib-node là native addon, cần toolchain để node-gyp biên dịch.
# openssl để Prisma phát hiện đúng libssl 3.x thay vì mặc định 1.1.x
RUN apk add --no-cache python3 make g++ openssl

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Giả sử backend chạy port 3000
EXPOSE 3000

# Lệnh chạy dev (nhớ cài nodemon hoặc ts-node-dev trong package.json)
CMD ["npm", "run", "start"]
