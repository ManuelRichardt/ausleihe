FROM node:22-alpine

WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm install --production

# Restlichen Code kopieren
COPY . .

# Wichtig: express-generator startet über bin/www
CMD ["npx", "pm2-runtime", "start", "./bin/www"]