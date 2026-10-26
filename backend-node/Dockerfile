FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
RUN npm install -g prisma
COPY . .
RUN npx prisma generate
# Giả sử backend chạy port 3000
EXPOSE 3000

# Lệnh chạy dev (nhớ cài nodemon hoặc ts-node-dev trong package.json)
CMD ["npm", "run", "dev"]