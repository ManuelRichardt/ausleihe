FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /usr/src/app/uploads/signatures \
  && chown -R node:node /usr/src/app

USER node

EXPOSE 3000

CMD ["node", "./bin/www"]
