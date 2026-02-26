FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p /app/public/uploads/asset-models \
    /app/public/uploads/categories \
    /app/public/uploads/lending-locations \
    /app/uploads/signatures \
    && chmod -R 775 /app/public/uploads /app/uploads

CMD ["npx", "pm2-runtime", "start", "./bin/www"]
